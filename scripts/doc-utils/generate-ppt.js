/**
 * 幻灯片生成脚本
 *
 * 读取 slides.json → 输出 .pptx 文件
 *
 * 用法:
 *   node scripts/doc-utils/generate-ppt.js slides.json output.pptx
 *
 * slides.json 格式:
 * {
 *   "title": "主标题",
 *   "subtitle": "副标题",
 *   "author": "翡翠进销存系统",
 *   "slides": [
 *     { "type": "title", "title": "章节", "subtitle": "说明" },
 *     { "type": "content", "title": "页标题", "bullets": ["点1","点2"], "image": "path" },
 *     { "type": "table", "title": "表格", "headers": ["A","B"], "rows": [["1","2"]] }
 *   ]
 * }
 */

const fs = require('fs');
const path = require('path');

async function main() {
  const [, , inputPath, outputPath] = process.argv;

  if (!inputPath || !outputPath) {
    console.error('用法: node generate-ppt.js <slides.json> <output.pptx>');
    process.exit(1);
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
  } catch (e) {
    console.error(`读取输入文件失败: ${e.message}`);
    process.exit(1);
  }

  const PptxGenJS = require('pptxgenjs');
  const pptx = new PptxGenJS();

  pptx.author = data.author || '翡翠进销存系统';
  pptx.title = data.title || '';
  pptx.subject = data.subtitle || '';
  pptx.layout = 'LAYOUT_WIDE';

  const bgColor = '059669';
  const accentColor = '065F46';

  for (const slide of (data.slides || [])) {
    switch (slide.type) {
      case 'title':
        addTitleSlide(pptx, slide, bgColor, accentColor);
        break;
      case 'content':
        await addContentSlide(pptx, slide, accentColor);
        break;
      case 'table':
        addTableSlide(pptx, slide, accentColor);
        break;
      default:
        addContentSlide(pptx, { title: slide.title || '', bullets: [JSON.stringify(slide)] });
    }
  }

  try {
    const outDir = path.dirname(path.resolve(outputPath));
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    await pptx.writeFile({ fileName: outputPath });
    console.log(`PPT 已生成: ${outputPath}`);
  } catch (e) {
    console.error(`生成 PPT 失败: ${e.message}`);
    process.exit(1);
  }
}

function addTitleSlide(pptx, slide, bgColor, accentColor) {
  const s = pptx.addSlide();
  s.background = { fill: bgColor };
  s.addText(slide.title || '', {
    x: 0.5, y: 2.0, w: 9, h: 1.5,
    fontSize: 36, color: 'FFFFFF', bold: true, fontFace: 'Microsoft YaHei',
    align: 'center', valign: 'middle',
  });
  if (slide.subtitle) {
    s.addText(slide.subtitle, {
      x: 0.5, y: 3.8, w: 9, h: 0.8,
      fontSize: 18, color: 'D1FAE5', fontFace: 'Microsoft YaHei',
      align: 'center', valign: 'top',
    });
  }
}

async function addContentSlide(pptx, slide, accentColor) {
  const s = pptx.addSlide();
  s.background = { fill: 'FFFFFF' };

  s.addText(slide.title || '', {
    x: 0.5, y: 0.3, w: 9, h: 0.8,
    fontSize: 24, color: accentColor, bold: true, fontFace: 'Microsoft YaHei',
  });

  s.addShape(pptx.ShapeType.rect, {
    x: 0.5, y: 1.1, w: 9, h: 0.04, fill: { color: accentColor },
  });

  const bullets = slide.bullets || [];
  if (bullets.length > 0) {
    s.addText(bullets.map(b => ({ text: b, options: { bullet: true, fontSize: 16 } })), {
      x: 0.5, y: 1.4, w: slide.image ? 5.5 : 9, h: 4.5,
      fontFace: 'Microsoft YaHei', color: '333333', valign: 'top',
      lineSpacingMultiple: 1.5,
    });
  }

  if (slide.image) {
    try {
      s.addImage({ path: slide.image, x: 6.5, y: 1.5, w: 3, h: 3.5 });
    } catch (e) {
      console.warn(`跳过无法加载的图片: ${slide.image}`);
    }
  }
}

function addTableSlide(pptx, slide, accentColor) {
  const s = pptx.addSlide();
  s.background = { fill: 'FFFFFF' };

  s.addText(slide.title || '', {
    x: 0.5, y: 0.3, w: 9, h: 0.8,
    fontSize: 24, color: accentColor, bold: true, fontFace: 'Microsoft YaHei',
  });

  const headers = slide.headers || [];
  const rows = slide.rows || [];
  const tableRows = [
    headers.map(h => ({
      text: h,
      options: { bold: true, color: 'FFFFFF', fontSize: 14, fontFace: 'Microsoft YaHei', fill: { color: accentColor } }
    })),
    ...rows.map(row =>
      row.map(cell => ({
        text: cell,
        options: { fontSize: 13, fontFace: 'Microsoft YaHei', color: '333333' }
      }))
    )
  ];

  s.addTable(tableRows, {
    x: 0.5, y: 1.5, w: 9,
    colW: headers.length > 0 ? Array(headers.length).fill(9 / headers.length) : undefined,
    border: { type: 'solid', pt: 0.5, color: 'D1D5DB' },
    rowH: [0.5, ...Array(rows.length).fill(0.4)],
    autoPage: false,
  });
}

main();