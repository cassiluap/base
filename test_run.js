const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf8');
const transformed = content
  .replace(/import .*/g, '')
  .replace(/export /g, '')
  .replace(/<.*>|return \(/g, '')
  .replace(/export default function App.+/g, '');

const script = `
  const Math = global.Math;
  ${transformed}
  console.log('Result:', getTerrainY(0, 0, 0.35));
`;
fs.writeFileSync('test_run.js', script);
