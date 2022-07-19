const fetch = require('node-fetch')
const { parse } = require('csv-parse')
const { pipeline } = require('stream')
const { promisify } = require('util')

const streamPipeline = promisify(pipeline)

const headers = [
  'assignment_name',
  'assignment_url',
  'starter_code_url',
  'github_username',
  'roster_identifier',
  'student_repository_name',
  'student_repository_url',
  'submission_timestamp',
  'points_awarded',
  'points_available'
]

function streamToString(stream) {
  const chunks = []
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(chunk))
    stream.on('error', reject)
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
  })
}

async function fetchAssignments(classroom, assigment, sessionToken) {

  return new Promise(async (resolve, reject) => {

    const url = `https://classroom.github.com/classrooms/${classroom}/assignments/${assigment}/download_grades`
    const response = await fetch(url, {
        headers: {
        accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'if-none-match': 'W/"91c8c819008d409c96ac22f96ff4029d"',
        'sec-ch-ua': '".Not/A)Brand";v="99", "Google Chrome";v="103", "Chromium";v="103"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'none',
        'sec-fetch-user': '?1',
        'upgrade-insecure-requests': '1',
        cookie:
            `_github_classroom_session=${sessionToken}`
        },
        referrerPolicy: 'strict-origin-when-cross-origin',
        body: null,
        method: 'GET'
    })

    if (response.ok) {
        const fileContent = await streamPipeline(response.body, streamToString)

        parse(
            fileContent,
            {
                delimiter: ',',
                columns: headers
            },
            async (error, result) => {
                if (error) {
                    reject(error)
                }
                // console.log("result:::"+result)
                if (!result) {
                    console.log(`download fail: ${url}`)
                    reject(`download fail: ${url}`)
                    return;
                }
                resolve(result.slice(1))
            }
        )
    } else {
        reject(`download fail: ${url}`)
    }
  })

}

module.exports = {
 fetchAssignments
}
