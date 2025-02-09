<script>
	import { addTodo } from '../stores/todos.js';
	let newTodo = '';

	function handleAdd() {
		if (newTodo.trim() !== '') {
			addTodo(newTodo);
			newTodo = '';
		}
	}
</script>

<div class="todo-input">
	<input
		type="text"
		bind:value={newTodo}
		placeholder="What needs to be done?"
		on:keydown={(e) => {
			if (e.key === 'Enter') handleAdd();
		}}
	/>
	<button on:click={handleAdd}>Add</button>
</div>

<style>
	.todo-input {
		display: flex;
		gap: 8px;
		margin-bottom: 1rem;
	}
	input {
		flex: 1;
		padding: 0.5rem;
	}
	button {
		padding: 0.5rem 1rem;
	}
</style>
