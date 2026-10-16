const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),sharp=require('sharp'),lu=require('react-icons/lu');
const names='Users Target Clock Ear Hand Timer Handshake Lightbulb BookOpen Image CircleCheck MessageCircle Pencil Mic Crown Heart Flag House Globe Sparkles Rocket Brain ClipboardCheck Eye Layers Sprout Mountain Puzzle Search NotebookPen Laptop Smile GraduationCap MessagesSquare Route ShieldCheck UserCheck Gauge ListChecks Presentation Check Trophy Calculator Star Accessibility QrCode BookText'.split(' ');
(async()=>{for(const n of names){for(const [suf,col] of [['','#16301F'],['-w','#FFFFFF'],['-m','#3E6350']]){
const svg=renderToStaticMarkup(React.createElement(lu['Lu'+n],{size:256,color:col,strokeWidth:2.2}));
await sharp(Buffer.from(svg)).resize(256,256).png().toFile(`icons/${n}${suf}.png`);}}console.log('done')})();
