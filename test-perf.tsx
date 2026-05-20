import React from 'react';
import { renderToString } from 'react-dom/server';
import { CalendarView } from './src/components/views/CalendarView';

const space = {
  id: "test",
  name: "test",
  columns: [],
  customFields: Array.from({ length: 50 }, (_, i) => ({ id: `field_${i}`, name: `Field ${i}`, type: 'text' })),
  tasks: Array.from({ length: 1000 }, (_, i) => ({
    id: `task_${i}`,
    title: `Task ${i}`,
    dueDate: new Date().toISOString(),
    status: 'todo',
    custom: Array.from({ length: 50 }, (_, j) => `field_${j}`).reduce((acc, fieldId) => ({ ...acc, [fieldId]: 'val' }), {})
  })),
  views: []
};

const start = performance.now();
for (let i = 0; i < 100; i++) {
  renderToString(<CalendarView space={space} onOpen={() => {}} />);
}
const end = performance.now();
console.log(`Render time: ${(end - start).toFixed(2)} ms`);
