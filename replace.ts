import * as fs from "fs";

let content = fs.readFileSync("src/App.tsx", "utf8");

content = content.replace(/<meshStandardMaterial([^>]+)>/g, (match, p1) => {
  let newProps = p1.replace(/\s*metalness=\{[^}]+\}/g, '');
  newProps = newProps.replace(/\s*roughness=\{[^}]+\}/g, '');
  
  return `<meshToonMaterial${newProps}>`;
});

fs.writeFileSync("src/App.tsx", content);
console.log("Done");
