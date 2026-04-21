export function run(): void {
  const tasks = ["scan", "analyze", "report"];
  for (const task of tasks) {
    console.log(`  - ${task}`);
  }
}
