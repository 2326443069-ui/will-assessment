const axios = require('axios');
const FormData = require('form-data');

export default async function handler(req, res) {
    // 只允许 POST 请求
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // 从前端接收 PDF 数据和文件名
    const { pdfBase64, filename } = req.body;

    // 从 Vercel 环境变量中读取你的企业微信配置（为了安全，不写死在代码里）
    const CORPID = process.env.CORPID;
    const CORPSECRET = process.env.CORPSECRET;
    const AGENTID = process.env.AGENTID;
    const TOUSER = process.env.TOUSER; // 对应你截图里的 "WILL319|ZH049"

    try {
        // ==========================================
        // 1. 获取 access_token (对应你的图1)
        // ==========================================
        const tokenUrl = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${CORPID}&corpsecret=${CORPSECRET}`;
        const tokenRes = await axios.get(tokenUrl);
        const accessToken = tokenRes.data.access_token;
        
        if (!accessToken) throw new Error('获取 access_token 失败');

        // ==========================================
        // 2. 上传 PDF 到企业微信临时素材 (对应你的图2)
        // ==========================================
        // 将前端传来的 base64 转换为文件流
        const buffer = Buffer.from(pdfBase64.split(',')[1], 'base64');
        const form = new FormData();
        form.append('media', buffer, { filename: filename, contentType: 'application/pdf' });

        const uploadUrl = `https://qyapi.weixin.qq.com/cgi-bin/media/upload?access_token=${accessToken}&type=file`;
        const uploadRes = await axios.post(uploadUrl, form, { headers: form.getHeaders() });
        const mediaId = uploadRes.data.media_id;
        
        if (!mediaId) throw new Error('上传文件到企业微信失败');

        // ==========================================
        // 3. 发送文件消息给指定用户 (对应你的图3)
        // ==========================================
        const sendUrl = `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${accessToken}`;
        const messageData = {
            touser: TOUSER,
            msgtype: "file",
            agentid: Number(AGENTID),
            file: {
                media_id: mediaId
            },
            safe: 0,
            enable_duplicate_check: 0,
            duplicate_check_interval: 1800
        };
        
        const sendRes = await axios.post(sendUrl, messageData);

        if (sendRes.data.errcode === 0) {
            res.status(200).json({ success: true, message: '发送成功' });
        } else {
            throw new Error(`企业微信发送失败: ${sendRes.data.errmsg}`);
        }

    } catch (error) {
        console.error("Error:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
}