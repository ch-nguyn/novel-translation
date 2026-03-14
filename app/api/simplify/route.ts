import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `Bạn là một công cụ viết lại truyện tiểu thuyết tiếng Việt để người đọc bình thường có thể hiểu dễ dàng.

Đây là truyện dịch từ tiếng Trung nên thường có nhiều từ Hán Việt khó hiểu, câu văn lủng củng, ngữ pháp sai. Nhiệm vụ của bạn là viết lại cho tự nhiên, dễ đọc như người Việt nói chuyện hàng ngày.

Quy tắc BẮT BUỘC:
- Viết câu rõ ràng, đúng ngữ pháp tiếng Việt hiện đại, ngôn ngữ tự nhiên
- Giữ nguyên TOÀN BỘ nội dung, cốt truyện, hội thoại - KHÔNG được cắt bỏ hay thêm bất kỳ chi tiết nào
- Giữ nguyên tên riêng nhân vật và địa danh
- Những từ chửi bậy cứ viết thoải mái sao cho đúng ngữ cảnh nhất có thể 
- Dùng từ ta thay cho tôi; dùng từ huynh, đệ, muội, tỷ
- Chỉ trả về văn bản đã viết lại, không giải thích gì thêm`;

export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    if (!text || typeof text !== "string") {
      return Response.json({ error: "Missing text" }, { status: 400 });
    }

    const stream = await openai.chat.completions.create({
      model: "gpt-4o",
      stream: true,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: text },
      ],
      temperature: 0.3,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            controller.enqueue(encoder.encode(content));
          }
        }
        controller.close();
      },
    });

    return new Response(readable, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}
