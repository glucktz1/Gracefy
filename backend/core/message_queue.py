"""
Message Queue Service for Gracefy.
Provides distributed task queue with RabbitMQ and in-memory fallback.
Supports async job processing for high-traffic scenarios.
"""

import os
import json
import asyncio
import logging
from typing import Any, Callable, Dict, List, Optional
from datetime import datetime, timezone
from dataclasses import dataclass, field
from enum import Enum
import uuid

logger = logging.getLogger(__name__)

# RabbitMQ configuration
RABBITMQ_URL = os.environ.get('RABBITMQ_URL', 'amqp://guest:guest@localhost:5672/')
RABBITMQ_ENABLED = os.environ.get('RABBITMQ_ENABLED', 'true').lower() == 'true'

# Queue names
class QueueName(str, Enum):
    ANALYTICS = "gracefy.analytics"
    NOTIFICATIONS = "gracefy.notifications"
    EMAILS = "gracefy.emails"
    AUDIO_PROCESSING = "gracefy.audio_processing"
    CACHE_INVALIDATION = "gracefy.cache_invalidation"
    DEFAULT = "gracefy.default"


@dataclass
class Job:
    """Represents a queued job."""
    job_id: str
    queue: str
    payload: Dict[str, Any]
    created_at: str
    status: str = "pending"
    attempts: int = 0
    max_attempts: int = 3
    result: Any = None
    error: str = None


class InMemoryQueue:
    """In-memory queue implementation for fallback."""
    
    def __init__(self):
        self._queues: Dict[str, List[Job]] = {}
        self._handlers: Dict[str, Callable] = {}
        self._processing = False
        self._stats = {
            'enqueued': 0,
            'processed': 0,
            'failed': 0,
        }
    
    def get_queue(self, name: str) -> List[Job]:
        if name not in self._queues:
            self._queues[name] = []
        return self._queues[name]
    
    async def enqueue(self, queue_name: str, payload: Dict[str, Any]) -> str:
        """Add job to queue."""
        job = Job(
            job_id=f"job_{uuid.uuid4().hex[:12]}",
            queue=queue_name,
            payload=payload,
            created_at=datetime.now(timezone.utc).isoformat(),
        )
        self.get_queue(queue_name).append(job)
        self._stats['enqueued'] += 1
        return job.job_id
    
    def register_handler(self, queue_name: str, handler: Callable):
        """Register a handler for a queue."""
        self._handlers[queue_name] = handler
    
    async def process_jobs(self):
        """Process pending jobs in all queues."""
        for queue_name, jobs in self._queues.items():
            handler = self._handlers.get(queue_name)
            if not handler:
                continue
            
            pending_jobs = [j for j in jobs if j.status == "pending"]
            for job in pending_jobs:
                try:
                    job.status = "processing"
                    job.attempts += 1
                    result = await handler(job.payload)
                    job.result = result
                    job.status = "completed"
                    self._stats['processed'] += 1
                except Exception as e:
                    logger.error(f"Job {job.job_id} failed: {e}")
                    job.error = str(e)
                    if job.attempts >= job.max_attempts:
                        job.status = "failed"
                        self._stats['failed'] += 1
                    else:
                        job.status = "pending"  # Retry
    
    def get_stats(self) -> dict:
        """Get queue statistics."""
        queue_stats = {}
        for name, jobs in self._queues.items():
            queue_stats[name] = {
                'total': len(jobs),
                'pending': len([j for j in jobs if j.status == "pending"]),
                'processing': len([j for j in jobs if j.status == "processing"]),
                'completed': len([j for j in jobs if j.status == "completed"]),
                'failed': len([j for j in jobs if j.status == "failed"]),
            }
        
        return {
            'type': 'memory',
            'queues': queue_stats,
            **self._stats
        }


class RabbitMQQueue:
    """RabbitMQ-based distributed queue."""
    
    def __init__(self):
        self._connection = None
        self._channel = None
        self._connected = False
        self._handlers: Dict[str, Callable] = {}
        self._fallback = InMemoryQueue()
        self._stats = {
            'enqueued': 0,
            'processed': 0,
            'failed': 0,
            'rabbitmq_errors': 0,
        }
    
    async def connect(self) -> bool:
        """Connect to RabbitMQ server."""
        if not RABBITMQ_ENABLED:
            logger.info("RabbitMQ disabled, using in-memory queue")
            return False
        
        try:
            import aio_pika
            
            self._connection = await aio_pika.connect_robust(
                RABBITMQ_URL,
                timeout=10,
            )
            self._channel = await self._connection.channel()
            
            # Declare all queues
            for queue_name in QueueName:
                await self._channel.declare_queue(
                    queue_name.value,
                    durable=True,
                )
            
            self._connected = True
            logger.info(f"✅ Connected to RabbitMQ at {RABBITMQ_URL}")
            return True
            
        except ImportError:
            logger.warning("aio_pika not installed. Using in-memory queue fallback.")
            return False
        except Exception as e:
            logger.warning(f"⚠️ RabbitMQ connection failed: {e}. Using in-memory fallback.")
            self._stats['rabbitmq_errors'] += 1
            return False
    
    async def disconnect(self):
        """Disconnect from RabbitMQ."""
        if self._connection:
            await self._connection.close()
            self._connection = None
            self._channel = None
            self._connected = False
            logger.info("Disconnected from RabbitMQ")
    
    async def enqueue(self, queue_name: str, payload: Dict[str, Any], priority: int = 0) -> str:
        """Add job to queue."""
        job_id = f"job_{uuid.uuid4().hex[:12]}"
        message = {
            'job_id': job_id,
            'payload': payload,
            'created_at': datetime.now(timezone.utc).isoformat(),
            'attempts': 0,
        }
        
        if self._connected and self._channel:
            try:
                import aio_pika
                
                await self._channel.default_exchange.publish(
                    aio_pika.Message(
                        body=json.dumps(message).encode(),
                        delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                        priority=priority,
                    ),
                    routing_key=queue_name,
                )
                self._stats['enqueued'] += 1
                return job_id
                
            except Exception as e:
                logger.error(f"RabbitMQ enqueue error: {e}")
                self._stats['rabbitmq_errors'] += 1
        
        # Fallback to in-memory
        return await self._fallback.enqueue(queue_name, payload)
    
    def register_handler(self, queue_name: str, handler: Callable):
        """Register a handler for a queue."""
        self._handlers[queue_name] = handler
        self._fallback.register_handler(queue_name, handler)
    
    async def start_consumer(self, queue_name: str):
        """Start consuming messages from a queue."""
        handler = self._handlers.get(queue_name)
        if not handler:
            logger.warning(f"No handler registered for queue: {queue_name}")
            return
        
        if self._connected and self._channel:
            try:
                import aio_pika
                
                queue = await self._channel.declare_queue(queue_name, durable=True)
                
                async def process_message(message: aio_pika.IncomingMessage):
                    async with message.process():
                        try:
                            data = json.loads(message.body.decode())
                            await handler(data['payload'])
                            self._stats['processed'] += 1
                        except Exception as e:
                            logger.error(f"Message processing error: {e}")
                            self._stats['failed'] += 1
                
                await queue.consume(process_message)
                logger.info(f"Started consuming from queue: {queue_name}")
                
            except Exception as e:
                logger.error(f"Consumer start error: {e}")
                self._stats['rabbitmq_errors'] += 1
    
    async def process_fallback_jobs(self):
        """Process jobs in fallback queue."""
        await self._fallback.process_jobs()
    
    def get_stats(self) -> dict:
        """Get queue statistics."""
        return {
            'type': 'rabbitmq' if self._connected else 'memory_fallback',
            'connected': self._connected,
            'rabbitmq_url': RABBITMQ_URL if self._connected else None,
            **self._stats,
            'fallback_stats': self._fallback.get_stats() if not self._connected else None,
        }


# Global queue instance
message_queue = RabbitMQQueue()


# ============== CONVENIENCE FUNCTIONS ==============

async def enqueue_job(queue_name: str, payload: Dict[str, Any], priority: int = 0) -> str:
    """Enqueue a job."""
    return await message_queue.enqueue(queue_name, payload, priority)


async def enqueue_analytics(event_type: str, data: Dict[str, Any]) -> str:
    """Enqueue analytics event."""
    return await message_queue.enqueue(
        QueueName.ANALYTICS.value,
        {'event_type': event_type, 'data': data}
    )


async def enqueue_notification(user_id: str, notification_type: str, data: Dict[str, Any]) -> str:
    """Enqueue user notification."""
    return await message_queue.enqueue(
        QueueName.NOTIFICATIONS.value,
        {'user_id': user_id, 'type': notification_type, 'data': data}
    )


async def enqueue_cache_invalidation(pattern: str) -> str:
    """Enqueue cache invalidation."""
    return await message_queue.enqueue(
        QueueName.CACHE_INVALIDATION.value,
        {'pattern': pattern}
    )


# ============== JOB HANDLERS ==============

async def handle_analytics_job(payload: Dict[str, Any]):
    """Process analytics job."""
    from core.database import get_db
    
    db = get_db()
    event_type = payload.get('event_type')
    data = payload.get('data', {})
    
    # Store analytics event
    await db.analytics_events.insert_one({
        'event_type': event_type,
        'data': data,
        'processed_at': datetime.now(timezone.utc).isoformat(),
    })
    
    logger.debug(f"Processed analytics event: {event_type}")


async def handle_cache_invalidation_job(payload: Dict[str, Any]):
    """Process cache invalidation job."""
    from core.redis_cache import invalidate_pattern
    
    pattern = payload.get('pattern')
    if pattern:
        await invalidate_pattern(pattern)
        logger.debug(f"Invalidated cache pattern: {pattern}")


# ============== BACKGROUND WORKER ==============

async def queue_worker_task(interval: int = 5):
    """Background task to process fallback queue jobs."""
    while True:
        try:
            await message_queue.process_fallback_jobs()
        except Exception as e:
            logger.error(f"Queue worker error: {e}")
        
        await asyncio.sleep(interval)


def register_default_handlers():
    """Register default job handlers."""
    message_queue.register_handler(QueueName.ANALYTICS.value, handle_analytics_job)
    message_queue.register_handler(QueueName.CACHE_INVALIDATION.value, handle_cache_invalidation_job)
