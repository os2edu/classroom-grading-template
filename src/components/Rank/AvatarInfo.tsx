import React from 'react'
import { Modal } from 'antd'
import contactInfo from '../../contact.json'

interface IProps {
  rank?: number
  avatarURL?: string
  name: string
}

export const MobileAvatarInfo = ({ name, avatarURL }: { name: string; avatarURL?: string }) => {
  const showWechat = () => {
    const contact = (contactInfo as Record<string, any>)[name]
    if (contact) {
      Modal.info({
        centered: true,
        width: 260,
        title: <span>微信号</span>,
        content: contact.wechat
      })
    }
  }
  return <img src={avatarURL} alt="avatar" onClick={showWechat} />
}

export const AvatarInfo = ({ rank, avatarURL, name }: IProps) => {
  const showWechat = () => {
    const contact = (contactInfo as Record<string, any>)[name]
    if (contact) {
      Modal.info({
        title: <span>微信号</span>,
        content: contact.wechat
      })
    }
  }
  return (
    <span className={`link student-info ${rank && rank < 4 ? 'top-three' : ''}`}>
      {avatarURL && <img src={avatarURL} alt="avatar" onClick={showWechat} />}
      <span
        title={name}
        className="student-info-name"
        onClick={() => window.open(`https://github.com/${name}`)}
      >
        {name}
      </span>
    </span>
  )
}
