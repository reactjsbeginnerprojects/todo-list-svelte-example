import { writable } from 'svelte/store';

export const todos = writable([]);

// Adds a new todo with a unique id
export function addTodo(text) {
	todos.update((todos) => [...todos, { id: Date.now(), text, completed: false }]);
}

// Toggle the completion status of a todo by id
export function toggleTodo(id) {
	todos.update((todos) =>
		todos.map((todo) => (todo.id === id ? { ...todo, completed: !todo.completed } : todo))
	);
}

// Remove a todo by id
export function deleteTodo(id) {
	todos.update((todos) => todos.filter((todo) => todo.id !== id));
}
