import sys, sherpa_onnx, numpy as np, scipy.io.wavfile as w, scipy.signal as ss
d=sys.argv.pop(1) if len(sys.argv)>2 and sys.argv[1].endswith('/') else 'sherpa-onnx-whisper-small/'
r=sherpa_onnx.OfflineRecognizer.from_whisper(encoder=d+'small-encoder.int8.onnx',decoder=d+'small-decoder.int8.onnx',tokens=d+'small-tokens.txt',language='ar',task='transcribe',num_threads=4)
for f in sys.argv[1:]:
    sr,x=w.read(f); x=x.astype(np.float32)/32768; x=ss.resample_poly(x,1,3)
    s=r.create_stream(); s.accept_waveform(16000,x); r.decode_stream(s); print(f.split('/')[-1],':',s.result.text)
