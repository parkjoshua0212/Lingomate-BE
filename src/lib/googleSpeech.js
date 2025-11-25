// src/lib/googleSpeech.js
// Google STT(음성 인식) 통역사 보관함

import { SpeechClient } from '@google-cloud/speech';
import path from 'path';

// 1. 프로젝트 루트에 있는 'google-credentials.json' 파일 경로 찾기
const keyFilename = path.join(process.cwd(), 'google-credentials.json');

// 2. 통역사(Client) 생성 (이때 키 파일을 사용함)
const speechClient = new SpeechClient({ keyFilename });

// 3. (편의 기능) 오디오 데이터를 받아서 '텍스트'로 바꿔주는 함수
export const transcribeAudio = async (audioBuffer) => {
  try {
    // Google STT에 보낼 요청 데이터
    const request = {
      audio: {
        content: audioBuffer.toString('base64'), // 오디오 데이터를 base64 문자열로 변환
      },
      config: {
        encoding: 'WEBM_OPUS', // (중요) 프론트엔드에서 보낼 오디오 형식 (안드로이드는 보통 이거 씀)
        sampleRateHertz: 16000, // 샘플링 레이트 (음질)
        languageCode: 'en-US',  // 인식할 언어 (일단 영어로 설정)
        // languageCode: 'ko-KR', // 한국어로 하고 싶으면 이거 주석 해제
      },
    };

    // STT API 호출!
    const [response] = await speechClient.recognize(request);
    
    // 결과에서 '텍스트'만 뽑아내기
    const transcription = response.results
      .map(result => result.alternatives[0].transcript)
      .join('\n');

    return transcription;

  } catch (error) {
    console.error('[Google STT] 변환 에러:', error);
    throw error; // 에러를 밖으로 던져서 server.js가 알게 함
  }
};

// 통역사 자체도 수출 (혹시 필요할까 봐)
export default speechClient;