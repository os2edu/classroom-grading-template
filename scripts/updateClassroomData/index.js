const fs = require('fs')
const dayjs = require('dayjs')
const _ = require('lodash')
require('dotenv').config()

// const userCache = require('../cache/user.json')
// const workflowCache = require('../cache/workflow.json')
const { fetchAssignments } = require('./assignments')
const { GitHubAPI } = require('./githubAPI')
const config = require('../../classroom.config.json')
const currentData = require('../../src/data.json')

const dataJSONPath = './src/data.json'
const userCache = {}
// const workflowCache = {}

// 兼容assignment为数组类型的情况
const extractAssignmentName = (assignment) => {
  return _.first([].concat(assignment))
}

async function run() {
  const parseClassrooms = config.classrooms
  if (_.isEmpty(parseClassrooms)) {
    console.log('There is nothing classrooms to parse, please check your config!')
    return []
  }

  if (!process.env.AUTH_TOKEN) throw new Error('please set AUTH_TOKEN firstly!')
  const api = new GitHubAPI({
    auth: process.env.AUTH_TOKEN,
    org: config.org
  })

  const findCurrentAssignmentData = (classroom, assignment) => {
    const currentClassroom = _.find(currentData.classrooms, (c) => c.id === classroom)
    if (currentClassroom) {
      return _.find(currentClassroom.assignments, (a) => a.title == assignment)
    }
  }

  const parseAssignments = async (classroom, assignments) => {
    return Promise.all(
      _.map(assignments, async (assignmentItem) => {
        assignmentItem = [].concat(assignmentItem) // 适配字段的两种类型 1. string, 2. [string, options]
        const assignment = assignmentItem[0]
        const options = assignmentItem[1] || {}
        if (!assignment) {
          throw new Error('assignment config wrong!')
        }
        const repos = await fetchAssignments(classroom, assignment, process.env.SESSION_TOKEN)

        const currentAssignment = findCurrentAssignmentData(classroom, assignment)
        const currentAssignmentUserMap = {}
        const currentAssignmentRepoMap = {}
        const currentAssignmentWorkflowMap = {}

        _.forEach(currentAssignment.student_repositories, (repo) => {
          currentAssignmentUserMap[repo.name] = repo.studentInfo
          if (repo.repo && repo.repo.name) {
            currentAssignmentRepoMap[repo.repo.name] = repo.repo
            if (repo.classroomWorkflowId) {
              currentAssignmentWorkflowMap[repo.repo.name] = repo.classroomWorkflowId
            }
          }
        })

        const student_repositories = await Promise.all(
          _.map(repos, async (repo) => {
            const studentName = repo.github_username
            const repoName = repo.student_repository_name

            let studentInfo =
              userCache[studentName] ||
              currentAssignmentUserMap[studentName] ||
              (await api.getUserInfo(studentName))
            if (studentInfo === 'NotFound') {
              studentInfo = {}
            } else {
              userCache[studentName] = studentInfo
            }

            const repoDetail = currentAssignmentRepoMap[repoName] || (await api.getRepo(repoName))
            if (!repoDetail) {
              console.log(`this repo: ${repoName} parse wrong, in classroom: ${classroom}`)
              return
            }

            let branchesOfRepo = [{ name: repoDetail.default_branch }]
            if (options.branches) {
              branchesOfRepo = await api.getBranches(repoName)
            }

            let branches = []
            const classroomWorkflowId =
              currentAssignmentWorkflowMap[repoName] || (await api.getClassroomWorkflowId(repoName))
            if (classroomWorkflowId) {
              const runs = await api.getWorkflowRuns(repoName, classroomWorkflowId)
              const runGroup = _.groupBy(runs, 'head_branch')
              branches = await Promise.all(
                _.filter(
                  branchesOfRepo,
                  (br) =>
                    br.name === repoDetail.default_branch || _.includes(options.branches, br.name)
                ).map(async (branch) => {
                  let runs = runGroup[branch.name]
                  const submitCommitCount = _.filter(runs, (run) => {
                    if (run.triggering_actor) {
                      return !run.triggering_actor.login.includes('github-classroom[bot]')
                    }
                    return true
                  }).length
                  if (_.isEmpty(runs)) {
                    console.log('runs data is empty', branch.name)
                    return
                  }
                  const hasSubmited = submitCommitCount > 0
                  let jobs = []
                  let autoGradingJob = null
                  const latestRun = _.find(runs, (run) => run.conclusion !== 'cancelled')
                  const firstSuccessRun = _.findLast(runs, (run) => run.conclusion === 'success')
                  const firstRun = _.last(runs)
                  if (hasSubmited && latestRun) {
                    jobs = await api.getJobs(repoName, latestRun.id)
                    if (_.isEmpty(jobs)) {
                      console.log('jobs data is empty', branch.name)
                      return
                    }
                    autoGradingJob = _.find(jobs, (job) => job.name === 'Autograding')
                    if (!autoGradingJob) {
                      console.log('autoGradingJob data is undefined', branch.name)
                      return
                    }
                  }
                  const isSuccess =
                    autoGradingJob && autoGradingJob
                      ? autoGradingJob.conclusion === 'success'
                      : false
                  return {
                    branchName: branch.name,
                    commitCount: submitCommitCount,
                    // runs,
                    autoGradingJob,
                    hasSubmited,
                    isSuccess,
                    firstSubmitedAt: hasSubmited && firstRun ? firstRun.run_started_at : '',
                    firstSuccessAt:
                      hasSubmited && firstSuccessRun ? firstSuccessRun.created_at : '',
                    latestUpdatedAt: hasSubmited && latestRun ? latestRun.created_at : '',
                    executeTime: latestRun
                      ? dayjs(latestRun.updated_at).diff(latestRun.run_started_at, 'second', true)
                      : null,
                    submission_timestamp: submitCommitCount && firstRun ? firstRun.created_at : '',
                    points_awarded: isSuccess ? '100' : '0',
                    points_available: latestRun ? '100' : '0'
                  }
                })
              )
            }

            branches = branches.filter((br) => !_.isEmpty(br))
            const defaultBranchIndex =
              branches.findIndex((branch) => branch.branchName === repoDetail.default_branch) || 0

            const defaultBranch = branches.splice(defaultBranchIndex, 1)[0] || {}

            return {
              name: studentName,
              avatar: studentInfo.avatar_url,
              studentInfo: studentInfo,
              classroomWorkflowId,
              repo: repoDetail,
              repoURL: repoDetail.html_url,
              languages: [].concat(repo.language || []),
              ...defaultBranch,
              branches
            }
          })
        )
        return {
          id: classroom + '-' + assignment,
          title: assignment,
          branches: options.branches,
          student_repositories: student_repositories.filter((item) => !!item)
        }
      })
    )
  }

  /**
   * 获取教室下一次要更新的作业
   */
  const getUpdateAssignments = (classroomConfig) => {
    const idx = currentData.classrooms.findIndex(
      (classroom) => classroom.id === classroomConfig.name
    )
    let updateAssignments = []
    if (idx > -1) {
      const currentClassroomData = currentData.classrooms[idx]
      if (currentClassroomData.lastUpdateAssignment) {
        const lastUpdateIdx = _.findIndex(
          currentClassroomData.assignments,
          (assignment) => assignment.title === currentClassroomData.lastUpdateAssignment
        )
        if (lastUpdateIdx > -1) {
          const endIndex = lastUpdateIdx + 1 + classroomConfig.updateStep
          updateAssignments = classroomConfig.assignments.slice(lastUpdateIdx + 1, endIndex)
          const overIndex = endIndex - classroomConfig.assignments.length
          if (overIndex > 0) {
            updateAssignments = updateAssignments.concat(
              classroomConfig.assignments.slice(0, overIndex)
            )
          }
        }
      } else {
        updateAssignments = classroomConfig.assignments.slice(0, classroomConfig.updateStep)
      }
    } else {
      updateAssignments = classroomConfig.assignments.slice(0, classroomConfig.updateStep)
    }

    return updateAssignments
  }
  /**
   * 局部刷新数据
   */
  const parsePartialAssignments = async (classroomFullName, classroomConfig, title) => {
    if (classroomConfig.assignments.length < classroomConfig.updateStep) {
      throw new Error('updateStep cannot less than assignment count!')
    }

    const updateAssignments = getUpdateAssignments(classroomConfig)
    console.log('partial parse assignments: ', updateAssignments)

    const idx = currentData.classrooms.findIndex(
      (classroom) => classroom.id === classroomConfig.name
    )
    if (idx > -1) {
      const newAssignments = await parseAssignments(classroomFullName, updateAssignments)
      _.forEach(newAssignments, (newAssignment) => {
        const assignmentIdx = _.findIndex(
          currentData.classrooms[idx].assignments,
          (item) => item.id === newAssignment.id
        )
        if (assignmentIdx > -1) {
          currentData.classrooms[idx].assignments[assignmentIdx] = newAssignment
        } else {
          currentData.classrooms[idx].assignments = (
            currentData.classrooms[idx].assignments || []
          ).concat(newAssignment)
        }
      })

      currentData.classrooms[idx].lastUpdateAssignment = extractAssignmentName(
        _.last(updateAssignments)
      )
      return currentData.classrooms[idx]
    } else {
      return {
        title,
        id: classroomFullName,
        desc: classroomConfig.desc || '',
        lastUpdateAssignment: extractAssignmentName(_.last(updateAssignments)),
        assignments: await parseAssignments(classroomFullName, updateAssignments)
      }
    }
  }

  const updateClassroomsData = (parseClassrooms) => {
    return _.map(parseClassrooms, async (classroomConfig) => {
      const classroomFullName = classroomConfig.name || classroomConfig.title

      const id = classroomFullName.split('-', 1)[0]
      if (!id) {
        console.log(`${classroomFullName} setting wrong, do again after checked!`)
        return
      }

      const classroomName = classroomFullName.slice(id.length + 1)
      const title = classroomName.split('-classroom')[0]

      // 每次只更新该教室的部分作业
      if (_.isNumber(classroomConfig.updateStep)) {
        return await parsePartialAssignments(classroomFullName, classroomConfig, title)
      }

      return {
        title,
        id: classroomFullName,
        desc: classroomConfig.desc || '',
        assignments: await parseAssignments(classroomFullName, classroomConfig.assignments)
      }
    })
  }

  const removeClassNameOfAssignment = (classroomName, assignmentId) => {
    return assignmentId.split(classroomName + '-')[1]
  }
  const findNextUpdateAssignments = (lastUpdateAssignment) => {
    const flattenAssignments = _.reduce(
      config.classrooms,
      (list, classroom) => {
        const assignments = classroom.assignments.map(
          (assignment) => classroom.name + '-' + extractAssignmentName(assignment)
        )
        return list.concat(assignments)
      },
      []
    )
    if (flattenAssignments.length < Number(config.updateStep)) {
      console.log("updateStep cannot less than all classroom's assignment count!")
      return []
    }

    const lastUpdateIdx = _.findIndex(
      flattenAssignments,
      (assignment) => assignment === lastUpdateAssignment
    )

    let updateAssignments = []
    if (lastUpdateIdx > -1) {
      const endIndex = lastUpdateIdx + 1 + config.updateStep
      updateAssignments = flattenAssignments.slice(lastUpdateIdx + 1, endIndex)
      const overIndex = endIndex - flattenAssignments.length
      if (overIndex > 0) {
        updateAssignments = updateAssignments.concat(flattenAssignments.slice(0, overIndex))
      }
    }

    return updateAssignments
  }

  const getDefaultLastUpdateAssignment = () => {
    const lastClassroom = _.last(parseClassrooms)
    return lastClassroom.name + '-' + extractAssignmentName(_.last(lastClassroom.assignments))
  }

  // 每次只更新部分作业, 按顺序执行更新
  if (_.isNumber(config.updateStep)) {
    const lastUpdateAssignment =
      currentData.lastUpdateAssignment || getDefaultLastUpdateAssignment()
    console.log('last time update assigment is: ', lastUpdateAssignment)

    const updateAssignments = findNextUpdateAssignments(lastUpdateAssignment)
    console.log('will update these assignments: ', updateAssignments)
    let partialParseClassrooms = [] // 更新部分教室作业数据
    config.classrooms.forEach((classroom) => {
      const assignmentsOfCurrentClassroom = updateAssignments.filter((assignment) =>
        assignment.includes(classroom.name)
      )
      const needUpdateAssignments = assignmentsOfCurrentClassroom.map((assignment) =>
        removeClassNameOfAssignment(classroom.name, assignment)
      )
      if (!_.isEmpty(assignmentsOfCurrentClassroom)) {
        partialParseClassrooms.push({
          ..._.omit(classroom, ['updateStep', 'assignments']),
          assignments: classroom.assignments.filter((assignment) =>
            needUpdateAssignments.includes(extractAssignmentName(assignment))
          )
        })
      }
    })
    console.log('==============partialParseClassrooms==============')
    console.log(partialParseClassrooms)
    const updateClassrooms = await Promise.all(updateClassroomsData(partialParseClassrooms))

    _.forEach(updateClassrooms, (cls) => {
      const classroomIdx = _.findIndex(
        currentData.classrooms,
        (classroom) => classroom.id === cls.id
      )
      if (classroomIdx > -1) {
        if (_.isEmpty(currentData.classrooms[classroomIdx].assignments)) {
          currentData.classrooms[classroomIdx] = cls
        } else {
          _.forEach(cls.assignments, (assignment) => {
            const oldAssignmentIdx = _.findIndex(
              currentData.classrooms[classroomIdx].assignments,
              (clsAssign) => clsAssign.id === assignment.id
            )
            if (oldAssignmentIdx > -1) {
              currentData.classrooms[classroomIdx].assignments[oldAssignmentIdx] = assignment
            } else {
              currentData.classrooms[classroomIdx].assignments =
                currentData.classrooms[classroomIdx].assignments.concat(assignment)
            }
          })
        }
      } else {
        currentData.classrooms = (currentData.classrooms || []).concat(cls)
      }
    })

    fs.writeFileSync(
      dataJSONPath,
      JSON.stringify({
        classrooms: currentData.classrooms,
        lastUpdateAssignment: _.last(updateAssignments),
        latest_updated_at: new Date(),
        apiUseCount: api.count
      })
    )
  } else {
    const classrooms = await Promise.all(updateClassroomsData(parseClassrooms))
    fs.writeFileSync(
      dataJSONPath,
      JSON.stringify({ classrooms, latest_updated_at: new Date(), apiUseCount: api.count })
    )
  }

  // fs.writeFileSync('./scripts/cache/user.json', JSON.stringify(userCache))
  // fs.writeFileSync('./scripts/cache/workflow.json', JSON.stringify(workflowCache))
  console.log('total api use count: ', api.count)
}

run()
