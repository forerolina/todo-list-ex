import { supabase } from './supabase-client'

const TODO_COLUMNS = 'id, text, is_completed, created_at, priority'

function normalizePriority(value) {
  if (value === 'high' || value === 'medium' || value === 'low') return value
  return 'medium'
}

function mapTodoRow(todoRow) {
  return {
    id: todoRow.id,
    text: todoRow.text,
    isCompleted: todoRow.is_completed,
    createdAt: todoRow.created_at,
    priority: normalizePriority(todoRow.priority),
  }
}

export async function listTodos() {
  const { data, error } = await supabase
    .from('todos')
    .select(TODO_COLUMNS)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map(mapTodoRow)
}

export async function addTodo(text, priority) {
  const p = normalizePriority(priority)
  const { data, error } = await supabase
    .from('todos')
    .insert({ text, priority: p })
    .select(TODO_COLUMNS)
    .single()

  if (error) throw error
  return mapTodoRow(data)
}

export async function toggleTodo(todoId, isCompleted) {
  const { data, error } = await supabase
    .from('todos')
    .update({ is_completed: isCompleted })
    .eq('id', todoId)
    .select(TODO_COLUMNS)
    .single()

  if (error) throw error
  return mapTodoRow(data)
}

export { normalizePriority }

export async function deleteTodo(todoId) {
  const { error } = await supabase.from('todos').delete().eq('id', todoId)
  if (error) throw error
}

export async function clearCompletedTodos() {
  const { error } = await supabase.from('todos').delete().eq('is_completed', true)
  if (error) throw error
}

export async function claimAnonymousTodos(anonymousUserId) {
  const { data, error } = await supabase.rpc('claim_anonymous_todos', {
    anonymous_user_id: anonymousUserId,
  })

  if (error) throw error
  return data ?? 0
}
