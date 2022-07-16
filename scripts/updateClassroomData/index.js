const fs = require('fs')
// const path = require('path')
const dayjs = require('dayjs')
const _ = require('lodash')
require('dotenv').config()
const userCache = require('../cache/user.json')
const workflowCache = require('../cache/workflow.json')

const { GitHubAPI } = require('./githubAPI')
const config = require('../../classroom.config.json')

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

  const reposResult = await api.getRepos()
  const repos = _.map(reposResult, (item) =>
    _.pick(item, [
      'name',
      'html_url',
      'language',
      'private',
      'created_at',
      'pushed_at',
      'updated_at'
    ])
  )

  const parseAssignments = async (assignments) => {
    return Promise.all(
      _.map(assignments, async (assignment) => {
        const currentAssignmentRepos = _.filter(repos, (repo) => repo.name.includes(assignment))
        return {
          id: assignment,
          title: assignment,
          student_repositories: await Promise.all(
            currentAssignmentRepos.map(async (repo) => {
              const [_assignmentName, author] = repo.name.split(assignment)
              const studentName = author.slice(1)

              const studentInfo = userCache[studentName] || (await api.getUserInfo(studentName))
              if (studentInfo === 'NotFound') {
                return null
              }
              userCache[studentName] = studentInfo

              const commits = await api.getRepoCommits(repo.name, repo.created_at)
              const hasSubmitAssignment = !_.isEmpty(commits)

              let runs = [] // 执行CI的任务
              let latestRun = null
              let latestRunJobs = [] // 最新CI任务的执行jobs
              let autoGradingJob = null // 执行排名的job

              if (hasSubmitAssignment) {
                const [GitHubClassroomWorkflowId, CIRuns] = await api.getCIInfo(
                  repo.name,
                  workflowCache[repo.name]
                )
                workflowCache[repo.name] = GitHubClassroomWorkflowId
                runs = CIRuns
                latestRun = _.first(runs)

                if (latestRun) {
                  latestRunJobs = await api.getJobs(repo.name, latestRun.id)
                  autoGradingJob = _.find(latestRunJobs, (job) => job.name === 'Autograding')
                }
              }

              const isSuccess = autoGradingJob ? autoGradingJob.conclusion === 'success' : false
              return {
                name: studentName,
                avatar: studentInfo.avatar_url,
                studentInfo: studentInfo,
                repoURL: repo.html_url,
                commits,
                runs,
                latestRunJobs,
                // latestRun,
                // latestRunJobs,
                // autoGradingJob,
                isSuccess,
                languages: [].concat(repo.language || []),
                executeTime: autoGradingJob ? dayjs(autoGradingJob.completed_at).diff(autoGradingJob.started_at, 'second', true) : null,
                submission_timestamp: hasSubmitAssignment
                  ? commits[0].commit.author.date
                  : '',
                points_awarded: isSuccess ? '100' : '0',
                points_available: hasSubmitAssignment ? '100' : '0'
              }
            })
          )
        }
      })
    )
  }

  const classrooms = await Promise.all(
    _.map(parseClassrooms, async (classroomConfig) => {
      const title = classroomConfig.name || classroomConfig.title
      return {
        id: title,
        title,
        desc: classroomConfig.desc || '',
        assignments: await parseAssignments(classroomConfig.assignments, repos)
      }
    })
  )

  fs.writeFileSync('./scripts/cache/user.json', JSON.stringify(userCache))
  fs.writeFileSync('./scripts/cache/workflow.json', JSON.stringify(workflowCache))
  fs.writeFileSync('./src/data.json', JSON.stringify(classrooms))
}

run()
