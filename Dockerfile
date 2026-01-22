FROM python:3.12

WORKDIR /app

# Install build tools and uv
RUN pip install --upgrade pip && pip install uv

# Copy dependency files first for better Docker caching
COPY pyproject.toml uv.lock ./

#RUN pip install --no-cache-dir --upgrade -r /code/requirements.txt



COPY . .
# Install dependencies with uv
RUN uv sync && uv sync --locked && uv pip install streamlit==1.52.1


ENV PATH="/app/.venv/bin:${PATH}"

EXPOSE 7860

CMD ["uv", "run", "streamlit", "run", "backend/app_streamlit.py", "--server.address", "0.0.0.0", "--server.port", "7860"]
#CMD ["streamlit", "run", "apps/app_streamlit.py", "--server.address", "0.0.0.0", "--server.port", "7860"]
