<script>
	import { toggleTodo, deleteTodo } from '../stores/todos.js';
	export let todo;
</script>

<li class:completed={todo.completed}>
	<input type="checkbox" checked={todo.completed} on:change={() => toggleTodo(todo.id)} />
	<span>{todo.text}</span>
	<button on:click={() => deleteTodo(todo.id)}>Delete</button>
</li>

<style>
	li {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 0.5rem 0;
	}
	.completed span {
		text-decoration: line-through;
		opacity: 0.6;
	}
	button {
		margin-left: auto;
	}
</style>
