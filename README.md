### 介绍

#### 该项目可用于快速部署一个 classroom 排行榜网站

其是根据 [Github Classroom](https://classroom.github.com/) 里同学们的提交记录，结合 [github pages](https://pages.github.com/) 来生成一个排行网站，可以查看当前每一个作业的完成情况，搜索到自己和其他学生的排名，方便大家更快的了解到课堂的整体进度，提高同学们的参与度，督促自己的成长和进步。

<div style="text-align: center"><img src="https://user-images.githubusercontent.com/108247373/179374302-0c54ef62-9338-4122-89f9-47d7f8dc2fab.png" alt="shortcut" width="200"/></div>

## 如何快速部署

### 1. Fork 项目

注意在 fork 时，需要将下面的 **Owner** 设置为 classroom 所在的组织下。

<img src="https://user-images.githubusercontent.com/920487/179538395-b8df34ad-5bb5-4ffb-88e5-394f39121068.png" alt="fork" width="400"/>

### 2. 添加环境变量

由于 action 在部署执行过程中会获取作业的最新数据，而更新的方式需要调用 [Github API](https://docs.github.com/cn/rest) 和 [classroom](https://classroom.github.com/classrooms) 的相关接口，因此需要配置以下两个变量获取访问接口的权限。

##### 2.1 设置 AUTH_TOKEN

a. 首先获取组织中任意 **Owner** 成员的 **Personal access tokens** ([详细参考](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token))

<img src="https://user-images.githubusercontent.com/920487/179375564-83b9360d-14be-470f-bae6-118098139fd6.png" alt="pat" width="400"/>

b. 回到项目 setting 中， 把上一步获取的 **Personal access tokens** 配置给 action 的环境变量 **AUTH_TOKEN**

<img src="https://user-images.githubusercontent.com/920487/179375600-8fc6102f-b7d0-40a2-a7d1-df026bbc290c.png" alt="pat" width="400"/>

##### 2.2 设置 SESSION_TOKEN

该变量的值是取登录到 classroom.github.com 网站中的 cookie.\_github_classroom_session 字段

<img src="https://user-images.githubusercontent.com/920487/179450068-c620e185-583f-4f83-a372-ee2c2825b805.png" alt="pat" width="400"/>

### 3 打开 workflow 开关

因为项目的 action 中有一个执行定时任务的 workflow， 需要手动开启。 该任务每小时会刷新一次排行榜数据。

<img src="https://user-images.githubusercontent.com/920487/179376541-0a906707-1a43-4d37-ab50-d19c8812f87b.png" alt="fork" width="600"/>

[为什么需要手动打开 workflow](https://github.com/laravel/framework/issues/34356#issuecomment-718831832)

### 4. 配置 gh-pages

项目的 setting 中进行 pages 设置

<img src="https://user-images.githubusercontent.com/920487/179375401-0d57b303-36c9-4599-88fd-0f4d93a095cd.png" alt="fork" width="600"/>

### 5. 修改配置

将 fork 的项目 clone 到本地，修改 **classroom.config.json**

```json
    {
        "org": "组织-必填",
        "classrooms": [
            {
            "name": "教室名称-必填",
            "assignments": [ "作业一", "作业二" ],
            "studentBlacklist": ["黑名单"]
            }
        ],
        "website": {
            "title": "LOGO标题"
        }
    }
```

#### 配置字段说明

| 字段       |        描述        |                          类型 | 是否必填 |
| ---------- | :----------------: | ----------------------------: | -------: |
| org        | classroom 所在组织 |                        string |       是 |
| classrooms |        教室        | [类型](#classroom-字段类型)[] |       是 |
| website    |     站点元信息     |     [类型](#website-字段类型) |       否 |

#### classroom 字段类型

| 字段             |                                             描述                                              |                           类型 | 是否必填 |
| ---------------- | :-------------------------------------------------------------------------------------------: | -----------------------------: | -------: |
| name             | 教室名称, 必须与实际信息一致，注意要求完整名称，包括 id，看[下图说明](#完整的-classroom-名称) |                         string |       是 |
| assignments      |                           需要展示的作业排行榜，必须与实际信息一致                            | [类型](#assignment-字段类型)[] |       否 |
| studentBlacklist |                              黑名单，用于过滤不参加排名的的学生                               |                                |       否 |

#### assignment 字段类型

| 字段 |           描述           |                       类型                       | 是否必填 |
| ---- | :----------------------: | :----------------------------------------------: | -------: |
| -    | 列出教室中参与排名的作业 | string[] 或 [Option](#assignment-配置参数类型)[] |       否 |

#### assignment 配置参数类型

类似于[babel](https://babeljs.io/docs/en/configuration)的插件化配置， 项目也支持对教室的 assignment 进行参数化配置。

比如目前项目支持按**分支维度**进行更细分地排行。

```json
{
  "assignments": ["learning-rust", { "branches": ["lab0", "lab1"] }]
}
```

| 字段     |           描述           |   类型   | 是否必填 |
| -------- | :----------------------: | :------: | -------: |
| branches | 列出仓库中参与排行的分支 | string[] |       否 |
| ...      |            -             |  - | -  |

#### website 字段类型

| 字段  |            描述            | 是否必填 |
| ----- | :------------------------: | -------: |
| title |      网站 logo 处名称      |       否 |
| ...   | 根据需要可后期开放其他字段 |        - |

#### 完整的 classroom 名称

<img src="https://user-images.githubusercontent.com/108247373/179397657-f8bbc0cf-958a-4edb-bf98-477591de013f.png" alt="config" width="200"/>

### 部署

修改完配置后 push 到 main 分支，会自动触发执行 action，等待几分钟后，便可以访问自己的排行榜页面了。

同时该项目设置了定时更新数据任务，每小时会执行一次，执行结束后，自动刷新页面内容.
