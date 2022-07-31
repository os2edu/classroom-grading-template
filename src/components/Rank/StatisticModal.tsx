import React from 'react'
import { map } from 'lodash'
import { Modal, ModalProps, Table } from 'antd'
import type { TClassroom } from './types'

interface IProps extends Partial<ModalProps> {
  classroom?: TClassroom
}

const StatisticModal = (props: IProps) => {
  const columns = [
    {
      title: '作业名称',
      dataIndex: 'title',
      key: 'title',
      render(text: string) {
        return <span style={{ fontWeight: 'bold' }}>{text}</span>
      }
    },
    {
      title: 'A(完成通过人数)',
      dataIndex: 'A',
      key: 'A'
    },
    {
      title: 'B(认领作业人数)',
      dataIndex: 'B',
      key: 'B'
    },
    {
      title: 'C(有提交作业但未通过人数)',
      dataIndex: 'C',
      key: 'C'
    },
    {
      title: 'A/B(通过率)',
      dataIndex: 'passRate',
      key: 'passRate'
    },
    {
      title: 'C/B(失败率)',
      dataIndex: 'failRate',
      key: 'failRate'
    },
    {
      title: 'A+C/B(动手率)',
      dataIndex: 'doingRate',
      key: 'doingRate'
    }
  ]

  const dataSource = map(props.classroom?.assignments, (assignment) => {
    const B = assignment.student_repositories.length
    const A = assignment.student_repositories.filter((repo) => repo.isSuccess).length
    const C = assignment.student_repositories.filter(
      (repo) => repo.hasSubmited && !repo.isSuccess
    ).length
    const passRate = `${((A / B) * 100).toFixed(2)}%`
    const failRate = `${((C / B) * 100).toFixed(2)}%`
    const doingRate = `${(((A + C) / B) * 100).toFixed(2)}%`
    return {
      key: assignment.id,
      title: assignment.title,
      A,
      B,
      C,
      passRate,
      failRate,
      doingRate
    }
  })

  return (
    <Modal title={`排行榜数据统计分析(${props.classroom?.title})`} width={'90%'} {...props}>
      <Table dataSource={dataSource} columns={columns} />
    </Modal>
  )
}

export default StatisticModal
