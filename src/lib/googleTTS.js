// src/lib/googleTTS.js
// Google TTS(음성 합성) 통역사 보관함

import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import path from 'path';

// 1. 키 파일 경로 (STT랑 같은 키 사용)
const keyFilename = path.join(process.cwd(), 'google-credentials.json');

// 2. TTS 통역사 생성
const ttsClient = new TextToSpeechClient({ keyFilename });

// 3. 텍스트를 받아서 '오디오(MP3)'로 바꿔주는 함수
export const synthesizeSpeech = async (text) => {
  try {
    const request = {
      input: { text: text },
      // voice: 언어 및 성별 설정 (일단 영어/중성으로 설정)
      // 나중에 프론트에서 언어 설정을 받아와서 바꾸면 됨
      voice: { languageCode: 'en-US', ssmlGender: 'NEUTRAL' },
      // audioConfig: MP3로 압축해서 받기
      audioConfig: { audioEncoding: 'MP3' },
    };

    // TTS API 호출!
    const [response] = await ttsClient.synthesizeSpeech(request);
    
    // 오디오 데이터(Binary Buffer) 반환
    return response.audioContent;

  } catch (error) {
    console.error('[Google TTS] 변환 에러:', error);
    throw error;
  }
};

export default ttsClient;