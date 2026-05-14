import * as fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

const sceneryRegex = /function Scenery\(\) \{([\s\S]*?)return \(/;
const match = code.match(sceneryRegex);

if (match) {
    let hooks = match[1];
    
    // Replace useMemo with IIFE
    let globalVars = hooks
        .replace(/const trees = useMemo\(\(\) => \{/g, 'const trees = (() => {')
        .replace(/const rocks = useMemo\(\(\) => \{/g, 'const rocks = (() => {')
        .replace(/const bushes = useMemo\(\(\) => \{/g, 'const bushes = (() => {')
        .replace(/const hills = useMemo\(\(\) => \{/g, 'const hills = (() => {')
        .replace(/const clouds = useMemo\(\(\) => \{/g, 'const clouds = (() => {')
        .replace(/const flowers = useMemo\(\(\) => \{/g, 'const flowers = (() => {')
        .replace(/  \}, \[\]\);/g, '})();');

    code = code.replace(hooks, '');
    code = code.replace(/function Scenery\(\) \{/, globalVars + '\n\nexport const obstacles = [\n  ...trees.map(t => ({x: t.x, z: t.z, r: 1.0 * t.scale})),\n  ...rocks.map(t => ({x: t.x, z: t.z, r: 0.5 * t.scale})),\n  ...bushes.map(t => ({x: t.x, z: t.z, r: 0.6 * t.scale})),\n  ...hills.map(t => ({x: t.x, z: t.z, r: Math.max(t.scaleX, t.scaleZ) * 0.8}))\n];\n\nfunction Scenery() {\n');
    
    fs.writeFileSync('src/App.tsx', code);
    console.log("Replaced successfully!");
} else {
    console.log("Could not match Scenery function.");
}
