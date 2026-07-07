const EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5';
const CHAT_MODEL = '@cf/meta/llama-3.1-8b-instruct';
const MAX_QUESTION_LENGTH = 800;
const MAX_CONTEXT_CHARS = 7000;

export const onRequestPost = async ({ request, env }) => {
        if (!env.AI || !env.TAX_DOCS_VECTORIZE) {
                return jsonResponse({ error: 'RAG bindings are not configured' }, 500);
        }

        let body;
        try {
                body = await request.json();
        } catch {
                return jsonResponse({ error: 'Expected JSON body' }, 400);
        }

        const question = String(body?.question || '').trim();
        if (!question) {
                return jsonResponse({ error: 'Question is required' }, 400);
        }
        if (question.length > MAX_QUESTION_LENGTH) {
                return jsonResponse({ error: `Question must be ${MAX_QUESTION_LENGTH} characters or fewer` }, 400);
        }

        const topK = Math.max(1, Math.min(Number(body?.topK || 6), 10));
        const embedding = await env.AI.run(EMBEDDING_MODEL, { text: [question] });
        const matches = await env.TAX_DOCS_VECTORIZE.query(embedding.data[0], {
                topK,
                returnMetadata: 'all'
        });

        const sources = (matches.matches || [])
                .filter(match => match?.metadata?.text)
                .map(match => ({
                        id: match.id,
                        score: match.score,
                        title: match.metadata.title,
                        agency: match.metadata.agency,
                        url: match.metadata.url,
                        path: match.metadata.path,
                        chunk: match.metadata.chunk,
                        text: String(match.metadata.text)
                }));

        const contextText = sources
                .map((source, index) => `[${index + 1}] ${source.title} (${source.agency})\n${source.text}`)
                .join('\n\n')
                .slice(0, MAX_CONTEXT_CHARS);

        const answer = await env.AI.run(CHAT_MODEL, {
                messages: [
                        {
                                role: 'system',
                                content: [
                                        'You answer Cook County property tax questions using only the provided source excerpts.',
                                        'If the excerpts do not answer the question, say you do not have enough source information.',
                                        'Be concise, practical, and cite sources inline like [1] or [2].',
                                        'Do not provide legal advice.'
                                ].join(' ')
                        },
                        {
                                role: 'user',
                                content: `Source excerpts:\n${contextText || 'No relevant excerpts found.'}\n\nQuestion: ${question}`
                        }
                ],
                temperature: 0.2,
                max_tokens: 700
        });

        return jsonResponse({
                answer: answer.response || '',
                sources: sources.map(({ text, ...source }) => source)
        });
};

function jsonResponse(payload, status = 200) {
        return new Response(JSON.stringify(payload), {
                status,
                headers: {
                        'Content-Type': 'application/json',
                        'Cache-Control': 'no-store'
                }
        });
}
