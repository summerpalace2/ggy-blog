# Bug 修复文档 v7

## ✅ 当前在位 (2024-06-21 final)
| ID | 描述 |
|----|------|
| B1 | Backspace/Delete 100ms防抖(key bounce) + __blockKeyHandled全局防重复 |
| B2 | 标题两段删除(justDemotedRef) |
| B3 | 引用有文字Backspace删字 |
| B4 | ✅ 有序列表Enter(空→p, 尾→ol, 中→ol) + 编号跨非ol块作用域连续 |
| B15 | ✅ ol菜单双按钮(跟随/重新开始) + 新ol自动跟随前序 |
| B16 | ✅ 作用域编号：跳过非ol块，同级标题为边界 |
| B5 | 独立图片缩放(startResize+四角) |
| B6 | 引用/代码Enter不拆(unsplittableTypes) |
| B7 | ✅ 贴图URL框隐藏(data:) |
| B8 | ✅ 拖入图片+有文→双栏(isDrop) |
| B9 | ✅ 粘贴图片→独立块(!isDrop) |
| B10 | 图片✕删整块(onDelete) |
| B11 | 侧图四角缩放(startSideResize) |
| B12 | 内拖图片移动不拦截(handleDragOver) |
| B13 | mergeUpward只splice一次 |
| B17 | ✅ generateId改时间戳+随机数，修复Fast Refresh后ID冲突 |
