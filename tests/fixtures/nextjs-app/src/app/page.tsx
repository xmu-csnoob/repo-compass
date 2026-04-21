import { capitalize } from "../lib/utils";

export default function HomePage() {
  return (
    <main>
      <h1>{capitalize("welcome")}</h1>
      <p>This is the home page.</p>
    </main>
  );
}
