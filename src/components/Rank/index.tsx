import React, { useState } from 'react'
import { Tree } from 'antd'
import type { DataNode, DirectoryTreeProps } from 'antd/lib/tree'
import RankList from './rank'
import ClassRankList from './classRank'
import { TAssignment, TClassroom } from './types'
import data from '../../data.json'
import MobileNav from './mobileNav'
import Icon from '../Icon'


import './index.less'

const { DirectoryTree } = Tree

// @ts-ignore
const classroomData = data.classrooms as TClassroom[]
const latest_updated_at = data.latest_updated_at

const findClassroom = (key: string): TClassroom | undefined => {
  return classroomData.find(({ id }) => id === key)
}

const findAssignment = (key: string): TAssignment | undefined => {
  const idx = classroomData.findIndex((item) =>
    item.assignments.some((assignment) => assignment.id === key)
  )
  if (idx > -1) {
    return classroomData[idx].assignments.find((assignment) => assignment.id === key)
  }
}

// const defaultSelectedAssignment = classRoom[0].assignments[0].id
const defaultSelectedClass =classroomData?.[0]?.id
const Rank = ({ isMobile }: { isMobile?: boolean }) => {
  const navRef = React.useRef<{ changeVisible: (visible: boolean) => void }>()
  const [hideNav, setHideNav] = useState(true)
  const treeData: DataNode[] = classroomData.map((item) => {
    return {
      title: item.title,
      key: item.id,
      isClass: true,
      children: item.assignments.map((assignment) => {
        return {
          title: assignment.title,
          key: assignment.id,
          isLeaf: true
        }
      })
    }
  })

  const [treeNodeId, setTreeNodeId] = useState<string>(defaultSelectedClass)
  const [isClassNode, setIsClassNode] = useState(true)

  const onSelect: DirectoryTreeProps['onSelect'] = (keys, info) => {
    setTreeNodeId(keys[0] as string)
    //@ts-ignore
    setIsClassNode(info.node.isClass)
    if (isMobile) {
      navRef.current?.changeVisible(false)
    }
  }

  return (
    <div className="rank-container">
      {isMobile ? (
        <MobileNav ref={navRef}>
          <DirectoryTree
            className="classroom-tree"
            multiple
            expandAction={false}
            defaultSelectedKeys={[treeNodeId]}
            defaultExpandAll
            onSelect={onSelect}
            treeData={treeData}
          />
        </MobileNav>
      ) : (
        <div className={`classroom-tree-area ${hideNav ? 'classroom-tree-tree-hidden' : ''}`}>
          <div className="fold-toggle" onClick={() => setHideNav(!hideNav)}>
            <Icon symbol="icon-autos-fold" />
          </div>
          <DirectoryTree
            className="classroom-tree"
            multiple
            expandAction={false}
            defaultSelectedKeys={[treeNodeId]}
            defaultExpandAll
            onSelect={onSelect}
            treeData={treeData}
          />
        </div>
      )}
      <main className="rank-list">
        {isClassNode ? (
          <ClassRankList isMobile={isMobile} classroom={findClassroom(treeNodeId)} />
        ) : (
          <RankList isMobile={isMobile} assignment={findAssignment(treeNodeId)} />
        )}
      </main>
    </div>
  )
}

export default Rank
