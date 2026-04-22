import { useState, useEffect } from "react";

interface Item {
  name: string;
  price: number;
}

function App() {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    fetch("/api/items")
      .then((res) => res.json())
      .then((data) => setItems(data));
  }, []);

  return (
    <div>
      <h1>Item List</h1>
      <ul>
        {items.map((item, i) => (
          <li key={i}>
            {item.name} — ${item.price}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
