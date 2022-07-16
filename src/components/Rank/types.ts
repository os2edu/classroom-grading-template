type TCommitAuthor = {
  date: string
  email: string
  name: string
}

type TCommitDetail = {
  author: TCommitAuthor
}

type TCommit = {
  html_url: string
  sha: string
  message: string
  commit: TCommitDetail
}

type TStudentInfo = {
  avatar_url: string
}

type TStep = {
  name: string
  status: string
  conclusion: string
  number: string
  started_at: string
  completed_at: string
}

type TJob = {
  id: string
  name: string
  conclusion: string
  status: string
  html_url: string
  completed_at: string
  started_at: string
  steps: TStep[]
}

type TRun = {
  id: string
  name: string
  event: string
  conclusion: string
  status: string
  check_suite_id: string
  head_branch: string
  html_url: string
  run_started_at: string
  update_at: string
  // jobs: IJob[]
}

export type TStudentHomework = {
  name: string
  avatar?: string
  studentInfo: TStudentInfo
  repoURL: string
  isSuccess: boolean
  commits: TCommit[]
  languages: string[]
  runs: TRun[]
  // latestRun?: TRun
  latestRunJobs?: TJob[]
  // autoGradingJob?: TJob
  executeTime?: string
  submission_timestamp: string
  points_awarded: string
  points_available: string
  rank?: number
}

export type TAssignment = {
  id: string
  title: string
  url?: string
  starter_code_url?: string
  student_repositories: TStudentHomework[]
}

export type TClassroom = {
  id: string
  title: string
  assignments: TAssignment[]
}
