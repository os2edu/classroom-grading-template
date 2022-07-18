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
const workflowCache = {}

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

  // console.log(s)
  // console.log('assigments')
  // return;
  // const reposResult = await api.getRepos()
  // const repos = _.map(reposResult, (item) =>
  //   _.pick(item, [
  //     'name',
  //     'html_url',
  //     'language',
  //     'private',
  //     'created_at',
  //     'pushed_at',
  //     'updated_at'
  //   ])
  // )

  const parseAssignments = async (classroom, assignments) => {
    return Promise.all(
      _.map(assignments, async (assignment) => {
        // const currentAssignmentRepos = _.filter(repos, (repo) => repoName.includes(assignment))
        const repos = await fetchAssignments(classroom, assignment, process.env.SESSION_TOKEN)
        const student_repositories = await Promise.all(
          _.map(repos, async (repo) => {
            // const [_assignmentName, author] = repoName.split(assignment)
            // const studentName = author.slice(1)
            const studentName = repo.github_username
            const repoName = repo.student_repository_name

            const studentInfo = userCache[studentName] || (await api.getUserInfo(studentName))
            if (studentInfo === 'NotFound') {
              return null
            }
            userCache[studentName] = studentInfo

            const repoDetail = await api.getRepo(repoName)
            if (!repoDetail) { 
              console.log(`this repo: ${repoName} parse wrong, in classroom: ${classroom}`)
              return; 
            }

            const commits = await api.getRepoCommits(repoName, repoDetail.created_at)
            const hasSubmitAssignment = !_.isEmpty(commits)

            let runs = [] // 执行CI的任务
            let latestRun = null // 最新执行的一次任务
            let latestRunJobs = [] // 最新CI任务的执行jobs
            let autoGradingJob = null // 执行排名的job

            if (hasSubmitAssignment) {
              const [GitHubClassroomWorkflowId, CIRuns] = await api.getCIInfo(
                repoName,
                workflowCache[repoName]
              )
              workflowCache[repoName] = GitHubClassroomWorkflowId
              runs = CIRuns
              latestRun = _.first(runs)

              if (latestRun) {
                latestRunJobs = await api.getJobs(repoName, latestRun.id)
                autoGradingJob = _.find(latestRunJobs, (job) => job.name === 'Autograding')
              }
            }

            const isSuccess = autoGradingJob ? autoGradingJob.conclusion === 'success' : false
            return {
              name: studentName,
              avatar: studentInfo.avatar_url,
              studentInfo: studentInfo,
              repo: repoDetail,
              repoURL: repoDetail.html_url,
              commits,
              runs,
              latestRunJobs,
              // latestRun,
              // latestRunJobs,
              // autoGradingJob,
              isSuccess,
              languages: [].concat(repo.language || []),
              executeTime: autoGradingJob
                ? dayjs(autoGradingJob.completed_at).diff(autoGradingJob.started_at, 'second', true)
                : null,
              submission_timestamp: hasSubmitAssignment ? commits[0].commit.author.date : '',
              points_awarded: isSuccess ? '100' : '0',
              points_available: hasSubmitAssignment ? '100' : '0'
            }
          })
        )
        return {
          id: classroom + assignment,
          title: assignment,
          student_repositories: student_repositories.filter(item => !!item)
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

      const title = classroomStr.slice(id.length + 1)
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
  fs.writeFileSync('./src/data.json', JSON.stringify({ classrooms, latest_updated_at: new Date() }))
}

run()
