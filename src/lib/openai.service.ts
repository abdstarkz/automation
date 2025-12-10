const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function generateWorkflowFromText(prompt: string): Promise<any> {
  try {
    const response = await fetch(`${API_BASE_URL}/ai/generate-workflow`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      credentials: 'include',
      body: JSON.stringify({ prompt, mode: 'text' }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate workflow');
    }

    const data = await response.json();
    return data.workflow;
  } catch (error: any) {
    console.error('Error generating workflow:', error);
    throw new Error(error.message || 'Failed to generate workflow. Please check your OpenAI API key in Settings.');
  }
}