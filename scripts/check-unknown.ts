/**
 * 统计无法识别的修正建议，找出遗漏的材质名
 */
import * as fs from 'fs';

const suggestions = JSON.parse(fs.readFileSync('scripts/user-suggestions.json', 'utf8'));

// 已知的映射 key
const KNOWN = new Set([
  '黄金999足金', '玛瑙', '足银990', '碧玺', '粉晶', '925银', '钛晶',
  '黄水晶', '斑彩螺', '玫瑰金', '金发晶', '海蓝宝', '金曜石',
  '银990', '黄翡', '东凌玉',
  '925银属贵金属(命中:925银)', '朱砂 关键词帝皇砂', '翡翠 关键词是白底青',
  '在铂金中有钻石字样实际就是铂金里面的钻石多反光面工艺 材质还是铂金来的',
  '组合型', '这种是组合型的有玉又有银', '这个名称还包含了尺寸你需要记录',
]);

const unknown = new Map<string, number>();
for (const s of suggestions) {
  const sug = s.suggestion.trim();
  if (sug.startsWith('按DB') || sug.includes('按推断')) continue;
  if (KNOWN.has(sug)) continue;
  unknown.set(sug, (unknown.get(sug) || 0) + 1);
}

console.log(`无法识别的修正建议（共 ${unknown.size} 种，${[...unknown.values()].reduce((a,b)=>a+b,0)} 条）:`);
for (const [sug, n] of [...unknown.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  "${sug}": ${n} 条`);
}
