"""
Unified LLM client supporting multiple providers
Routes based on LLM_MODEL environment variable format: "provider/model-name"

"""

import os
from typing import Optional


class LLMClient:
    def __init__(self):
        self.model_config = os.getenv('LLM_MODEL', '')
        self.api_key = os.getenv('LLM_API_KEY', '')
        self.base_url = os.getenv('LLM_BASE_URL', 'http://localhost:11434')

        # Parse provider and model from LLM_MODEL
        if '/' in self.model_config:
            self.provider, self.model = self.model_config.split('/', 1)
        else:
            # Default to ollama if no provider specified
            self.provider = 'ollama'
            self.model = self.model_config

        self._validate_provider()
        self._log_config()

    def _validate_provider(self):
        """Validate that provider is supported"""
        supported = ['ollama', 'claude', 'openai', 'custom']
        if self.provider not in supported:
            raise ValueError(f"Unsupported provider: {self.provider}. Supported: {supported}")

        # Validate API key for services that require it
        if self.provider in ['claude', 'openai'] and not self.api_key:
            raise ValueError(f"{self.provider} requires LLM_API_KEY environment variable")

    def _log_config(self):
        """Log configuration for debugging"""
        print(f"   Model: {self.model}")

    def generate(self, prompt: str) -> str:
        """Generate text using configured LLM"""
        if self.provider == 'ollama':
            return self._generate_ollama(prompt)
        elif self.provider == 'claude':
            return self._generate_claude(prompt)
        elif self.provider == 'openai':
            return self._generate_openai(prompt)
        else:
            raise ValueError(f"Unknown provider: {self.provider}")




    def _generate_ollama(self, prompt: str) -> str:
        """Generate using Ollama (local)"""
        try:
            import ollama

            response = ollama.generate(model=self.model, prompt=prompt)
            text = response['response'].strip()
            return text.strip('"').strip("'")
        except Exception as e:
            raise RuntimeError(f"Ollama generation failed: {e}")

    def _generate_claude(self, prompt: str) -> str:
        """Generate using Claude/Anthropic"""
        try:
            from anthropic import Anthropic

            client = Anthropic(api_key=self.api_key)
            message = client.messages.create(
                model=self.model,
                max_tokens=1024,
                messages=[{"role": "user", "content": prompt}]
            )
            return message.content[0].text
        except Exception as e:
            raise RuntimeError(f"Claude generation failed: {e}")



    def _generate_openai(self, prompt: str) -> str:
        """Generate using OpenAI"""
        try:
            from openai import OpenAI

            client = OpenAI(api_key=self.api_key)
            response = client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=1024
            )
            return response.choices[0].message.content
        except Exception as e:
            raise RuntimeError(f"OpenAI generation failed: {e}")


if __name__ == "__main__":
    # Test the client
    client = LLMClient()
    print("\nTesting LLM client...")
    response = client.generate("Write a single sentence about pizza.")
    print(f"Response: {response}")
