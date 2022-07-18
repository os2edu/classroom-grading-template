### 介绍

#### 该项目可用于快速部署一个 classroom 排行榜网站

其是根据 [Github Classroom](https://classroom.github.com/) 里同学们的提交记录，结合 [github pages](https://pages.github.com/) 来生成一个排行网站，可以查看当前每一个作业的完成情况，搜索到自己和其他学生的排名，方便大家更快的了解到课堂的整体进度，提高同学们的参与度，督促自己的成长和进步。

<div style="text-align: center"><img src="https://user-images.githubusercontent.com/108247373/179374302-0c54ef62-9338-4122-89f9-47d7f8dc2fab.png" alt="shortcut" width="200"/></div>

### 如何快速部署

#### 1. Fork 项目

注意在 fork 时，需要将 **Owner** 设置为 classroom 所在的组织下。

<img src="https://user-images.githubusercontent.com/108247373/179374180-2c4ae639-3295-409d-8fcc-610bd018bacb.png" alt="fork" width="400"/>

#### 2. 添加环境变量

由于 action 在部署执行过程中会获取作业的最新数据，而更新的方式需要调用 [Github API](https://docs.github.com/cn/rest) 和 [classroom] (https://classroom.github.com/classrooms)的相关接口，因此需要配置以下两个变量获取访问接口的权限。

##### AUTH_TOKEN

a. 首先获取组织中任意 **Owner** 成员的 **Personal access tokens** ([详细参考](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token))

<img src="https://user-images.githubusercontent.com/920487/179375564-83b9360d-14be-470f-bae6-118098139fd6.png" alt="pat" width="400"/>

b. 回到项目 setting 中， 把上一步获取的 **Personal access tokens** 配置给 action 的环境变量 **AUTH_TOKEN**

<img src="https://user-images.githubusercontent.com/920487/179375600-8fc6102f-b7d0-40a2-a7d1-df026bbc290c.png" alt="pat" width="400"/>

##### SESSION_TOKEN

该变量的值是取登录到 classroom.github.com 网站中的 cookie.\_github_classroom_session字段

<img src="https://user-images.githubusercontent.com/920487/179450068-c620e185-583f-4f83-a372-ee2c2825b805.png" alt="pat" width="400"/>

#### 3 打开 workflow 开关

因为项目的 action 中有一个执行定时任务的 workflow， 需要手动开启。 该任务每小时会刷新一次排行榜数据。

<img src="https://user-images.githubusercontent.com/920487/179376541-0a906707-1a43-4d37-ab50-d19c8812f87b.png" alt="fork" width="600"/>

[为什么需要手动打开 workflow](https://github.com/laravel/framework/issues/34356#issuecomment-718831832)

#### 4. 配置 gh-pages

项目的 setting 中进行 pages 设置

<img src="https://user-images.githubusercontent.com/920487/179375401-0d57b303-36c9-4599-88fd-0f4d93a095cd.png" alt="fork" width="600"/>

#### 5. 修改配置

将 fork 的项目 clone 到本地，修改 **classroom.config.json**

注意配置字段中 **org** 和 **classrooms** 是重要字段，决定数据采集的准确性, 必须与实际信息保证一致。

<img src="https://user-images.githubusercontent.com/920487/179450921-b7a53c40-cccb-4648-8ea8-8000f8f02432.png" alt="config" width="400"/>

#### 字段

| 字段       |        描述        | 是否必填 |
| ---------- | :----------------: | -------: |
| org        | classroom 所在组织 |       是 |
| classrooms |        教室        |       否 |
| website    |     站点元信息     |       否 |

#### classrooms 内部字段

| 字段             |                           描述                            | 是否必填 |
| ---------------- | :-------------------------------------------------------: | -------: |
| name             | 必须与实际信息一致, 注意要求完整名称，包括 id，看下图说明 |       是 |
| assignments      |         需要展示的作业排行榜, 必须与实际信息一致          |       是 |
| studentBlacklist |            黑明单，用于过滤不参加排名的的学生             |       否 |

完整的 classroom 名称:

<img src="https://user-images.githubusercontent.com/108247373/179397657-f8bbc0cf-958a-4edb-bf98-477591de013f.png" alt="config" width="200"/>

#### website 内部字段

| 字段  |        描述        | 是否必填 |
| ----- | :----------------: | -------: |
| title |  网站 logo 处名称  |       否 |
| ...   | 根据需要可后期开放 |        - |

修改完成后 push 到 main 分支, 会自动触发执行 action，等待几分钟后，便可以访问自己的排行榜页面了
