import { describe, expect, it } from 'vitest';
import { checkVideo, parseProbe, SAFE_VIDEO_NAME, videoFileName, type VideoSpec } from './video';

const spec: VideoSpec = { width: 1080, height: 1920, fps: 30, totalFrames: 285, durationSec: 9.5 };

const ffprobeJson = {
  streams: [{ codec_name: 'h264', pix_fmt: 'yuv420p', width: 1080, height: 1920, r_frame_rate: '30/1', nb_frames: '285', duration: '9.500000' }],
  format: { duration: '9.500000' },
};

describe('leitura do ffprobe', () => {
  it('interpreta os campos usados', () => {
    expect(parseProbe(ffprobeJson)).toEqual({
      codec: 'h264', pixelFormat: 'yuv420p', width: 1080, height: 1920, frameRate: '30/1', frames: 285, durationSec: 9.5,
    });
  });

  it('usa a duração do contêiner quando o stream não traz', () => {
    const p = parseProbe({ streams: [{ ...ffprobeJson.streams[0], duration: undefined, nb_frames: undefined }], format: { duration: '9.48' } });
    expect(p?.durationSec).toBe(9.48);
    expect(p?.frames).toBeNull();
  });

  it('rejeita saídas sem vídeo', () => {
    expect(parseProbe(null)).toBeNull();
    expect(parseProbe({ streams: [] })).toBeNull();
    expect(parseProbe({ streams: [{ codec_name: 'h264' }] })).toBeNull();
  });
});

describe('verificação do MP4', () => {
  it('aceita o arquivo esperado', () => {
    expect(checkVideo(spec, parseProbe(ffprobeJson)!)).toEqual([]);
  });

  it('aponta cada divergência', () => {
    const bad = { codec: 'hevc', pixelFormat: 'yuv444p', width: 1080, height: 1080, frameRate: '25/1', frames: 200, durationSec: 8 };
    const problems = checkVideo(spec, bad);
    expect(problems).toHaveLength(6);
    expect(problems.join(' ')).toMatch(/1080×1080.*1080×1920/);
  });

  it('tolera um quadro de diferença na duração', () => {
    const p = parseProbe(ffprobeJson)!;
    expect(checkVideo(spec, { ...p, durationSec: 9.5 + 1 / 30 })).toEqual([]);
    expect(checkVideo(spec, { ...p, durationSec: 9.7 })).toHaveLength(1);
  });
});

it('gera nomes de arquivo seguros', () => {
  const name = videoFileName('Gestão & Liderança: 5 lições', spec);
  expect(name).toBe('eminente-motion-gestao-lideranca-5-licoes-1080x1920-30fps.mp4');
  expect(SAFE_VIDEO_NAME.test(name)).toBe(true);
  expect(SAFE_VIDEO_NAME.test('../segredo.mp4')).toBe(false);
  expect(SAFE_VIDEO_NAME.test('a.mp4.exe')).toBe(false);
});
