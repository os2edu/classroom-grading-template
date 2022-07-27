const fs = require('fs')
const dayjs = require('dayjs')
const _ = require('lodash')
require('dotenv').config()

// const userCache = require('../cache/user.json')
// const workflowCache = require('../cache/workflow.json')
const { fetchAssignments } = require('./assignments')
const { GitHubAPI } = require('./githubAPI')
const config = require('../../classroom.config.json')

const userCache = {}
// const workflowCache = {}

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

  const parseAssignments = async (classroom, assignments) => {
    return Promise.all(
      _.map(assignments, async (assignmentItem) => {
        assignmentItem =[].concat(assignmentItem)
        const assignment = _.first(assignmentItem)
        const options = assignmentItem[1] || {}
        if(!assignment) {
          throw new Error('assignment config wrong!')
        }
        const repos = await fetchAssignments(classroom, assignment, process.env.SESSION_TOKEN)
        const student_repositories = await Promise.all(
          _.map(repos, async (repo) => {
            const studentName = repo.github_username
            const repoName = repo.student_repository_name

            let studentInfo = userCache[studentName] || (await api.getUserInfo(studentName))
            if (studentInfo === 'NotFound') {
              studentInfo = {}
            } else {
              userCache[studentName] = studentInfo
            }

            const repoDetail = await api.getRepo(repoName)
            if (!repoDetail) {
              console.log(`this repo: ${repoName} parse wrong, in classroom: ${classroom}`)
              return
            }

            const branchesOfRepo = await api.getBranches(repoName)

            let branches = []
            const classroomWorkflowId = await api.getClassroomWorkflowId(repoName)
            if (classroomWorkflowId) {
              const runs = await api.getWorkflowRuns(repoName, classroomWorkflowId)
              const runGroup = _.groupBy(runs, 'head_branch')
              branches = await Promise.all(
                _.filter(branchesOfRepo, br => br.name === repoDetail.default_branch || _.includes(options.branches, br.name)).map(async (branch) => {
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
                  let autoGradingJob = undefined
                  if (hasSubmited) {
                    jobs = await api.getJobs(repoName, runs[0].id)
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
                  const isSuccess = autoGradingJob && autoGradingJob ? autoGradingJob.conclusion === 'success' : false
                  const latestRun = _.first(runs)
                  const firstRun = _.last(runs)
                  return {
                    branchName: branch.name,
                    commitCount: submitCommitCount,
                    runs,
                    autoGradingJob,
                    hasSubmited,
                    isSuccess,
                    firstSubmitedAt: hasSubmited && firstRun ? firstRun.run_started_at : '',
                    latestUpdatedAt: hasSubmited && latestRun ? latestRun.run_started_at : '',
                    executeTime: autoGradingJob
                      ? dayjs(autoGradingJob.completed_at).diff(
                          autoGradingJob.started_at,
                          'second',
                          true
                        )
                      : null,
                    submission_timestamp: submitCommitCount && firstRun ? firstRun.created_at : '',
                    points_awarded: isSuccess ? '100' : '0',
                    points_available: submitCommitCount && firstRun ? '100' : '0'
                  }
                })
              )
            }

            branches = branches.filter(br => !_.isEmpty(br))
            const defaultBranchIndex = (branches).findIndex(
              (branch) => branch.branchName === repoDetail.default_branch
            ) || 0

            const defaultBranch = branches.splice(defaultBranchIndex, 1)[0] || {}

            return {
              name: studentName,
              avatar: studentInfo.avatar_url,
              studentInfo: studentInfo,
              repo: repoDetail,
              repoURL: repoDetail.html_url,
              languages: [].concat(repo.language || []),
              ...defaultBranch,
              branches,
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

  const classrooms = await Promise.all(
    _.map(parseClassrooms, async (classroomConfig) => {
      const classroomStr = classroomConfig.name || classroomConfig.title
      const id = classroomStr.split('-', 1)[0]
      if (!id) {
        console.log(`${classroomStr} setting wrong, do again after checked!`)
        return
      }

      const classroomName = classroomStr.slice(id.length + 1)
      const title = classroomName.split('-classroom')[0]
      return {
        title,
        id: classroomStr,
        desc: classroomConfig.desc || '',
        assignments: await parseAssignments(classroomStr, classroomConfig.assignments)
      }
    })
  )

  // fs.writeFileSync('./scripts/cache/user.json', JSON.stringify(userCache))
  // fs.writeFileSync('./scripts/cache/workflow.json', JSON.stringify(workflowCache))
  console.log('api use count: ', api.count)
  fs.writeFileSync('./src/data.json', JSON.stringify({ classrooms, latest_updated_at: new Date(), apiUseCount: api.count }))
}

run()
