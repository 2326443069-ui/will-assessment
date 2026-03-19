import axios from 'axios';
import FormData from 'form-data';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { pdfBase64, filename } = req.body;
    const CORPID = process.env.CORPID;
    const CORPSECRET = process.env.CORPSECRET;
    const AGENTID = process.env.AGENTID;
    const TOUSER = process.env.TOUSER;

    try {
        // 1. 获取 access_token
        const tokenUrl = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${CORPID}&corpsecret=${CORPSECRET}`;
        const tokenRes = await axios.get(tokenUrl);
        const accessToken = tokenRes.data.access_token;
        
        if (!accessToken) throw new Error('获取 access_token 失败: ' + JSON.stringify(tokenRes.data));

        // 2. 上传 PDF
        const buffer = Buffer.from(pdfBase64.split(',')[1], 'base64');
        const form = new FormData();
        // 强制使用英文文件名，防止中文乱码导致上传失败
        form.append('media', buffer, { filename: 'report.pdf', contentType: 'application/pdf' });

        const uploadUrl = `https://qyapi.weixin.qq.com/cgi-bin/media/upload?access_token=${accessToken}&type=file`;
        const uploadRes = await axios.post(uploadUrl, form, { headers: form.getHeaders() });
        
        // 关键修改：如果上传失败，把企业微信返回的错误信息打印出来
        if (uploadRes.data.errcode !== 0) {
            throw new Error(`上传失败: ${uploadRes.data.errmsg} (错误码: ${uploadRes.data.errcode})`);
        }
        const mediaId = uploadRes.data.media_id;

        // 3. 发送消息
        const sendUrl = `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${accessToken}`;
        const messageData = {
            touser: TOUSER,
            msgtype: "file",
            agentid: Number(AGENTID),
            file: { media_id: mediaId },
            safe: 0
        };
        
        const sendRes = await axios.post(sendUrl, messageData);
        if (sendRes.data.errcode === 0) {
            res.status(200).json({ success: true });
        } else {
            throw new Error(`发送失败: ${sendRes.data.errmsg}`);
        }

    } catch (error) {
        console.error("详细错误信息:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
}