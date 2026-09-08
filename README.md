# Mckinnon — A Scent Archive

一个以面具为入口、以香水瓶保存观剧记忆的沉浸式个人档案网站。每条记录会生成一瓶带有心情色的香水；最珍贵的记录可以放进独立收藏层板，并从六款典藏瓶型中选择最终容器。

> Every performance leaves a scent.

## 功能

- 可拖动的多视角面具与可逆滚动穿眼转场
- 香水柜、空状态、机械数字计数与响应式瓶架
- 四步观剧记录表单，支持完整中文长文本
- 1v1 角色多选、自定义角色，以及完整角色建议
- 六款现实感典藏香水瓶与独立 `THE TREASURED SHELF`
- 桌面端拖瓶入收藏；触屏和键盘可在详情页直接选择瓶型
- 详情、前后浏览、编辑、删除与收藏瓶型更换
- 按年份筛选的 Index 辅助视图
- 带版本迁移的 localStorage 持久化
- JSON 导出、校验导入、覆盖或按 ID 合并
- `prefers-reduced-motion` 与键盘操作支持

## 本地运行

需要 Node.js `>=22.13.0`。

```bash
git clone <your-repository-url>
cd mckinnon-scent-archive
npm ci
npm run dev
```

打开终端显示的本地地址即可。项目不需要环境变量、数据库或第三方账号；所有私人记录默认只保存在当前浏览器。

生产构建：

```bash
npm run build
npm run start
```

当前生产构建使用 [vinext](https://github.com/cloudflare/vinext)，可部署为 Cloudflare Worker。界面本身没有后端依赖，也可以在保留 `app/` 目录的前提下改用标准 Next.js 部署链路。

## 数据结构

核心类型位于 `lib/memory-storage.ts`：

```ts
type PerformanceMemory = {
  id: string;
  date: string;
  moodColor: string;
  hadOneOnOne: boolean;
  oneOnOneWith: string[];
  mostMemorableCharacter: string;
  memoryText: string;
  isFavorite: boolean;
  favoriteBottleStyle: FavoriteBottleStyle | null;
  createdAt: string;
  updatedAt: string;
};
```

存储适配器会将旧版单个 1v1 字符串迁移为数组，并为旧记录补齐收藏字段。应用不会使用 `dangerouslySetInnerHTML` 渲染记忆正文。

## 收藏瓶型

六款瓶型定义在 `app/MckinnonArchive.tsx` 的 `COLLECTION_BOTTLES` 中，图像位于 `public/assets/collection/`：

1. The Ivory Seal
2. The Raven
3. The Serpent
4. The Stag
5. The Moon
6. The White Mask

如需替换为自己的视觉资产，请保留文件路径，或同时更新 `COLLECTION_BOTTLES` 的 `image` 字段。建议使用正方形 WebP、暗色摄影棚背景和一致的瓶身比例。

## 在 GitHub 开源

```bash
git init
git add .
git commit -m "Initial open-source release"
git branch -M main
git remote add origin https://github.com/<your-name>/<repository>.git
git push -u origin main
```

仓库已经包含 MIT 许可证。`package.json` 中的 `private: true` 只用于避免误发布到 npm，不影响 GitHub 仓库公开。

## 隐私说明

记录只存于浏览器 localStorage。清理浏览器站点数据会删除记录，因此建议定期使用 `INDEX → EXPORT JSON` 备份。公开部署网站不会自动公开任何人的记忆；每位访问者拥有独立的本地档案。

## 资产与品牌

本项目是个人创意档案界面，不是任何演出、酒店或香水品牌的官方网站。代码以 MIT 许可证发布。提交公开仓库或商业部署前，请确认你对所使用的图片、名称与衍生视觉拥有相应权利；也可以直接替换 `public/assets/` 中的参考素材。

## License

[MIT](./LICENSE)
