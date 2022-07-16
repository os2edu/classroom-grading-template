import React, { useState, useMemo } from 'react'
import { Table, Progress } from 'antd'
import { orderBy, map, groupBy, keys, flatMap } from 'lodash'
import Icon from '../../components/Icon'
import type { ColumnsType } from 'antd/lib/table'
import type { TClassroom, TAssignment, TStudentHomework } from './types'
import Search, { ISearchProps } from './search'
import AssignmentBar from './assignmentBar'

interface IProps {
  classroom?: TClassroom
  isMobile?: boolean
}

interface IDatasource {
  name: string
  avatar?: string
  homeworks: TStudentHomework[]
  totalScore: number
  averageScore: number
  rank?: number
}

const ClassRoomRank = (props: IProps) => {
  const [query, setQuery] = useState<Partial<ISearchProps>>({})

  const classroomId = props.classroom?.id
  const columns: ColumnsType<IDatasource> = useMemo(
    () => [
      {
        title: '排名',
        dataIndex: 'rank',
        align: 'center',
        fixed: true,
        width: 80,
        key: 'rank',
        render(text: number) {
          let content: React.ReactNode = text
          switch (text) {
            case 1:
              content = <Icon symbol="icon-autojiangbei-" />
              break
            case 2:
              content = <Icon symbol="icon-autojiangbei-1" />
              break
            case 3:
              content = <Icon symbol="icon-autojiangbei-2" />
              break
            default:
              break
          }
          return <span className="rank-modal">{content}</span>
        }
      },
      {
        title: '学生',
        align: 'center',
        dataIndex: 'name',
        fixed: true,
        className: 'top-three',
        width: 150,
        key: 'repoOwner',
        render(text: string, record: IDatasource) {
          return (
            <span
              className="link student-info"
              onClick={() => window.open(`https://github.com/${text}`)}
            >
              {record.avatar && <img src={record.avatar} alt="avatar" />}
              <span title={text} className="student-info-name">
                {text}
              </span>
            </span>
          )
        }
      },
      {
        title: '平均分',
        align: 'center',
        width: 100,
        fixed: true,
        dataIndex: 'averageScore',
        className: 'top-three',
        key: 'averageScore'
      },
      ...(map(props.classroom?.assignments, (item: TAssignment) => {
        return {
          title: item.title,
          dataIndex: `assignments-${item.id}`,
          width: 200,
          align: 'center',
          key: item.id,
          render(_text: string, record: IDatasource) {
            const homework = record.homeworks.find(({ repoURL }) => repoURL.includes(item.title))
            if (homework && homework.submission_timestamp) {
              return <AssignmentBar score={Number(homework.points_awarded || 0)} />
            }
            return <span>-</span>
          }
        }
      }) as ColumnsType<IDatasource>),
      {
        title: '',
        dataIndex: 'none',
        key: 'none'
      }
    ],
    // eslint-disable-next-line
    [classroomId]
  )

  let dataSource: IDatasource[] = useMemo(() => {
    const studentHomeworkds = flatMap(map(props.classroom?.assignments, 'student_repositories'))
    const studentGroups = groupBy(studentHomeworkds, 'name')
    const studentAchievement = map(keys(studentGroups), (studentName) => {
      const homeworks = studentGroups[studentName]
      const totalScore = homeworks.reduce((total, homework) => {
        if (homework.submission_timestamp) {
          return total + Number(homework.points_awarded || 0)
        }
        return total
      }, 0)
      return {
        name: studentName,
        avatar: homeworks[0]?.studentInfo.avatar_url,
        homeworks,
        totalScore,
        averageScore: Math.floor(totalScore / props.classroom!.assignments.length)
      }
    })
    return orderBy(studentAchievement, ['averageScore'], ['desc']).map((item, index) => ({
      ...item,
      rank: index + 1
    }))
    //eslint-disable-next-line
  }, [classroomId])

  dataSource = dataSource.filter((item: IDatasource) => {
    let searchName = true
    if (query.name) {
      searchName = item.name.toLowerCase().includes(query.name.toLowerCase())
    }
    return searchName
  })

  const setClassname = (rank: number) => {
    const ranks = ['championship', 'second-place', 'third-place']
    return ranks[rank] || ''
  }

  const renderMobileRankList = () => {
    return (
      <ul className="rank-table-mobile">
        {dataSource.map((item) => {
          return (
            <li
              className={`rank-table-row ${setClassname((item.rank || 0) - 1)}`}
              key={item.name + item.rank}
            >
              <span className="list-order-index">{item.rank}</span>
              <span
                className="info-avartar"
                onClick={() => window.open(`https://github.com/${item.name}`)}
              >
                {(item.rank || 1000) <= 3 && (
                  <Icon className="order-hat" symbol="icon-autorexiao-huangguan" />
                )}
                <img src={item.avatar} alt="avatar" />
              </span>
              <div className="rank-info">
                <span>{item.name}</span>
                <div className="rank-homeworks">
                  {map(props.classroom?.assignments, (assigment: TAssignment) => {
                    const homework = item.homeworks.find(({ repoURL }) =>
                      repoURL.includes(assigment.title)
                    )
                    if (homework && homework.submission_timestamp) {
                      return (
                        <span className="homework-item" key={assigment.id}>
                          <Progress
                            strokeColor={'rgb(82, 196, 26)'}
                            trailColor="#ff4d4f"
                            type="circle"
                            width={20}
                            style={{ fontSize: '12px' }}
                            percent={Number(homework.points_awarded || 0)}
                          />
                        </span>
                      )
                    }
                    return (
                      <span className="homework-item" key={assigment.id}>
                        <span className="homework-undo">-</span>
                      </span>
                    )
                  })}
                </div>
              </div>
              <span
                className={`rank-score ${item.averageScore === 100 ? 'rank-score-success' : ''}`}
              >
                {item.averageScore}
              </span>
            </li>
          )
        })}
      </ul>
    )
  }
  return (
    <>
      <Search
        isMobile={props.isMobile}
        defaultQuery={query}
        onChange={(query) => setQuery(query)}
        noLang
      />
      {props.isMobile ? (
        renderMobileRankList()
      ) : (
        <Table
          className="rank-table"
          scroll={{ x: 1000 }}
          rowKey={'name'}
          dataSource={dataSource}
          columns={columns}
          size="middle"
        />
      )}
    </>
  )
}

export default ClassRoomRank
