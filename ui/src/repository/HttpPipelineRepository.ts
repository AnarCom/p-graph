import type {
  NodeCatalog,
  PipelineDraft,
  ValidationResult,
} from '../domain/pipeline';
import type { PipelineRepository } from './PipelineRepository';

export interface HttpPipelineRepositoryOptions {
  baseUrl?: string;
}

interface ApiErrorBody {
  message?: string;
}

const defaultBaseUrl = 'http://apiserver.local';

export class HttpPipelineRepository implements PipelineRepository {
  private readonly baseUrl: string;

  constructor(options: HttpPipelineRepositoryOptions = {}) {
    this.baseUrl = options.baseUrl ?? defaultBaseUrl;
  }

  async getNodeCatalog(version?: string) {
    const query = version ? `?version=${encodeURIComponent(version)}` : '';

    return this.getJson<NodeCatalog>(`/node-catalog${query}`);
  }

  async getDraft(pipelineId: string) {
    return this.getJson<PipelineDraft>(pipelinePath(pipelineId, 'draft'));
  }

  async saveDraft(draft: PipelineDraft) {
    await this.request(pipelinePath(draft.pipelineId, 'draft'), {
      method: 'PUT',
      body: JSON.stringify(draft),
    });
  }

  async resetDraft(pipelineId: string) {
    return this.getJson<PipelineDraft>(pipelinePath(pipelineId, 'draft'), {
      method: 'DELETE',
    });
  }

  async validateDraft(draft: PipelineDraft) {
    return this.getJson<ValidationResult>(
      pipelinePath(draft.pipelineId, 'validate'),
      {
        method: 'POST',
        body: JSON.stringify(draft.definition),
      },
    );
  }

  private async getJson<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await this.request(path, init);

    return (await response.json()) as T;
  }

  private async request(path: string, init?: RequestInit): Promise<Response> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }

    return response;
  }
}

function pipelinePath(pipelineId: string, suffix: string) {
  return `/pipelines/${encodeURIComponent(pipelineId)}/${suffix}`;
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as ApiErrorBody;

    if (typeof body.message === 'string') {
      return body.message;
    }
  } catch {
    return `${response.status} ${response.statusText}`;
  }

  return `${response.status} ${response.statusText}`;
}
