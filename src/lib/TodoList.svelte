<script>
	import { todos } from '../stores/todos.js';
	import TodoItem from './TodoItem.svelte';
	export let filter = 'all'; // Possible values: 'all', 'active', 'completed'
</script>

<ul class="todo-list">
	{#each $todos as todo (todo.id)}
		{#if filter === 'all' || (filter === 'active' && !todo.completed) || (filter === 'completed' && todo.completed)}
			<TodoItem {todo} />
		{/if}
	{/each}
</ul>

<style>
	.todo-list {
		list-style: none;
		padding: 0;
	}
</style>
