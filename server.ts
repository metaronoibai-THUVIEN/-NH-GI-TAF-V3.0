import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini API client on the server side
let ai: GoogleGenAI | null = null;
const apiKey = process.env.GEMINI_API_KEY;

if (apiKey) {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

// API Health route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// Server-side AI TAF Analysis route
app.post('/api/gemini/analyze', async (req, res) => {
  try {
    if (!ai) {
      return res.status(503).json({
        error: 'Tính năng AI tạm thời chưa khả dụng. Hãy cấu hình GEMINI_API_KEY trong Settings > Secrets.'
      });
    }

    const { station, accuracy, elements, rawTaf } = req.body;

    const prompt = `
Bạn là một chuyên gia khí tượng hàng không cao cấp và huấn luyện viên dự báo viên.
Hãy phân tích chất lượng của bản tin TAF dưới đây dựa trên kết quả đánh giá thực tế từ quan trắc METAR/SPECI:

Sân bay: ${station}
Điểm đánh giá chung của bản tin: ${accuracy}%
Điểm chi tiết từng yếu tố:
- Hướng gió (DD): ${elements.DD}%
- Tốc độ gió (FF): ${elements.FF}%
- Tầm nhìn (VV): ${elements.VV}%
- Hiện tượng thời tiết (WW): ${elements.WW}%
- Lượng mây (CC): ${elements.CC}%
- Độ cao mây (HH): ${elements.HH}%

Bản tin TAF gốc:
"${rawTaf}"

Yêu cầu phân tích bằng tiếng Việt:
1. Đánh giá tóm tắt chất lượng bản tin TAF này (Ưu điểm và những điểm sai lệch lớn).
2. Phân tích cụ thể các yếu tố có điểm thấp (đặc biệt là các yếu tố dưới 70%) và chỉ ra nguyên nhân khí tượng có thể xảy ra (ví dụ: dự báo mây quá thấp/cao, bỏ sót hiện tượng thời tiết nguy hiểm, hướng gió lệch lớn).
3. Đưa ra 3 khuyến nghị hoặc bài học rút ra thiết thực cho dự báo viên để nâng cao độ chính xác trong lần sau (ví dụ: cách sử dụng BECMG/TEMPO hợp lý hơn, theo dõi sát xu hướng áp thấp/giông).

Hãy viết phản hồi một cách chuyên nghiệp, mang tính xây dựng, ngôn từ chuẩn ngành khí tượng hàng không Việt Nam (ví dụ dùng thuật ngữ: bản tin dự báo, quan trắc thực tế, mốc đột biến, phân nhóm mây, độ lệch gió...).
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt
    });

    res.json({ analysis: response.text });
  } catch (error) {
    console.error('Gemini Analysis Error:', error);
    res.status(500).json({ error: 'Đã xảy ra lỗi trong quá trình phân tích bằng AI: ' + (error as Error).message });
  }
});

// Setup Vite middleware or static serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  });
}

startServer();
