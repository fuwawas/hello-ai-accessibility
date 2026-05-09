const express = require('express');
const { getDb } = require('../models/database');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * 获取 VL API 配置（优先 MiMo，备选 OpenAI）
 */
function getVlApiConfig() {
  // 优先使用 MiMo API
  if (process.env.MIMO_API_KEY) {
    return {
      baseUrl: process.env.MIMO_BASE_URL || 'https://token-plan-cn.xiaomimimo.com/v1',
      apiKey: process.env.MIMO_API_KEY,
      model: process.env.MIMO_MODEL || 'MiMo-V2-Omni',
      provider: 'mimo'
    };
  }
  // 备选 OpenAI
  if (process.env.OPENAI_API_KEY) {
    return {
      baseUrl: 'https://api.openai.com/v1',
      apiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-4o-mini',
      provider: 'openai'
    };
  }
  return null;
}

/**
 * 获取文本对话 API 配置
 */
function getChatApiConfig() {
  if (process.env.MIMO_API_KEY) {
    return {
      baseUrl: process.env.MIMO_BASE_URL || 'https://token-plan-cn.xiaomimimo.com/v1',
      apiKey: process.env.MIMO_API_KEY,
      model: process.env.MIMO_CHAT_MODEL || 'MiMo-V2.5-Pro',
      provider: 'mimo'
    };
  }
  if (process.env.OPENAI_API_KEY) {
    return {
      baseUrl: 'https://api.openai.com/v1',
      apiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-4o-mini',
      provider: 'openai'
    };
  }
  return null;
}

// AI 场景描述（用于视障辅助，VL 多模态）
router.post('/describe', optionalAuth, async (req, res) => {
  try {
    const { image, context, conversation_id } = req.body;

    if (!image) {
      return res.status(400).json({ error: '请提供图片数据' });
    }

    const config = getVlApiConfig();
    if (!config) {
      const mockDescription = generateMockDescription(context);
      return res.json({ description: mockDescription, source: 'local' });
    }

    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: 'system',
            content: '你是一个为视障人士服务的 AI 助手。请用简洁、准确的语言描述图片内容，重点关注：1) 前方是否有障碍物 2) 场景中的关键物体 3) 安全提示。回复请使用中文，语气要友好、有帮助性。'
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: context || '请描述这张图片中的场景，特别注意安全相关信息。' },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${image}` } }
            ]
          }
        ],
        max_tokens: 300
      })
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message || JSON.stringify(data.error));
    }

    const description = data.choices[0].message.content;

    // 保存对话记录
    if (req.user) {
      const db = getDb();
      const convId = conversation_id || `conv_${Date.now()}`;

      db.prepare(
        'INSERT INTO ai_conversations (user_id, conversation_id, role, content, module) VALUES (?, ?, ?, ?, ?)'
      ).run(req.user.id, convId, 'user', '[图片]', 'blind');

      db.prepare(
        'INSERT INTO ai_conversations (user_id, conversation_id, role, content, module) VALUES (?, ?, ?, ?, ?)'
      ).run(req.user.id, convId, 'assistant', description, 'blind');
    }

    res.json({ description, source: config.provider });
  } catch (err) {
    console.error('AI 描述错误:', err);
    res.status(500).json({ error: '场景描述失败，请稍后重试' });
  }
});

// AI 对话（通用）
router.post('/chat', optionalAuth, async (req, res) => {
  try {
    const { message, module, conversation_id } = req.body;

    if (!message) {
      return res.status(400).json({ error: '请提供消息内容' });
    }

    const config = getChatApiConfig();
    if (!config) {
      const mockResponse = generateMockChatResponse(message, module);
      return res.json({ reply: mockResponse, source: 'local' });
    }

    // 获取历史对话
    let history = [];
    if (req.user && conversation_id) {
      const db = getDb();
      history = db.prepare(
        'SELECT role, content FROM ai_conversations WHERE user_id = ? AND conversation_id = ? ORDER BY created_at DESC LIMIT 10'
      ).all(req.user.id, conversation_id).reverse();
    }

    const systemPrompts = {
      blind: '你是视障人士的 AI 助手。用简洁、清晰的语言回答问题，重点提供安全和导航相关信息。',
      deaf: '你是听障人士的 AI 助手。帮助理解语音内容，提供文字转译和沟通辅助。',
      cognitive: '你是认知障碍人士的 AI 助手。用简单、分步骤的方式解释事物，避免复杂概念。',
      physical: '你是肢体障碍人士的 AI 助手。提供设备控制和操作建议。',
      elderly: '你是老年用户的 AI 助手。用耐心、温和的语气回答问题，字体和说明要大而清晰。'
    };

    const systemPrompt = systemPrompts[module] || systemPrompts.blind;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: message }
    ];

    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        max_tokens: 500
      })
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message || JSON.stringify(data.error));
    }

    const reply = data.choices[0].message.content;

    // 保存对话
    if (req.user) {
      const db = getDb();
      const convId = conversation_id || `conv_${Date.now()}`;

      db.prepare(
        'INSERT INTO ai_conversations (user_id, conversation_id, role, content, module) VALUES (?, ?, ?, ?, ?)'
      ).run(req.user.id, convId, 'user', message, module);

      db.prepare(
        'INSERT INTO ai_conversations (user_id, conversation_id, role, content, module) VALUES (?, ?, ?, ?, ?)'
      ).run(req.user.id, convId, 'assistant', reply, module);
    }

    res.json({ reply, source: config.provider });
  } catch (err) {
    console.error('AI 对话错误:', err);
    res.status(500).json({ error: '对话失败，请稍后重试' });
  }
});

// 模拟描述（无 API Key 时使用）
function generateMockDescription(context) {
  const descriptions = [
    '前方道路畅通，没有明显障碍物。可以看到一条人行道，建议沿当前方向继续前行。',
    '检测到前方有一个人正在行走，距离约 3 米。建议保持当前路线。',
    '前方有一个十字路口，红灯亮起。请在当前位置等待，绿灯亮起后再通行。',
    '当前环境为室内，前方有一扇门。门是关闭状态，需要用手推开。',
    '前方有一段楼梯，共约 10 级台阶。建议使用扶手，小心下行。'
  ];
  return descriptions[Math.floor(Math.random() * descriptions.length)];
}

// 模拟对话（无 API Key 时使用）
function generateMockChatResponse(message, module) {
  const responses = {
    blind: '作为您的视障辅助助手，我建议您保持当前方向前行。如需更多帮助，请随时告诉我。',
    deaf: '我已将语音内容转换为文字。如需进一步帮助，请告诉我。',
    cognitive: '让我用简单的步骤来解释：1. 首先... 2. 然后... 3. 最后... 如果还有疑问，请告诉我。',
    physical: '我理解您的需求。建议使用语音命令来完成这个操作。',
    elderly: '别着急，慢慢来。我来帮您一步一步完成这个操作。'
  };
  return responses[module] || responses.blind;
}

module.exports = router;
