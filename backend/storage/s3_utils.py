import os
import uuid
from urllib.parse import urlparse

import boto3

# Environment variable names expected:
# - AWS_ACCESS_KEY_ID
# - AWS_SECRET_ACCESS_KEY
# - AWS_DEFAULT_REGION (or AWS_REGION)
# - S3_BUCKET_NAME (preferred) or AWS_STORAGE_BUCKET_NAME
BUCKET_NAME = os.environ.get("S3_BUCKET_NAME") or os.environ.get("AWS_STORAGE_BUCKET_NAME")
AWS_REGION = os.environ.get("AWS_DEFAULT_REGION") or os.environ.get("AWS_REGION")


def _client():
    """Create an S3 client using standard AWS env vars."""
    return boto3.client(
        "s3",
        region_name=AWS_REGION,
        aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY"),
    )


def build_key(filename: str, prefix: str = "uploads") -> str:
    """Construct a safe S3 object key."""
    name = filename or "upload"
    ext = ""
    if "." in name:
        ext = "." + name.split(".")[-1]
    return f"{prefix.rstrip('/')}/{uuid.uuid4().hex}{ext}"


def presign_upload(key: str, content_type: str = "image/jpeg", expires_in: int = 900) -> dict:
    """
    Generate a presigned POST for direct-to-S3 upload.
    Returns dict with url and fields for form-data.
    """
    if not BUCKET_NAME:
        raise RuntimeError("S3 bucket name not configured (set S3_BUCKET_NAME or AWS_STORAGE_BUCKET_NAME)")
    client = _client()
    return client.generate_presigned_post(
        Bucket=BUCKET_NAME,
        Key=key,
        Fields={"Content-Type": content_type},
        Conditions=[{"Content-Type": content_type}],
        ExpiresIn=expires_in,
    )


def presign_download(key: str, expires_in: int = 900) -> str:
    """Generate a presigned URL to download a private object."""
    if not BUCKET_NAME:
        raise RuntimeError("S3 bucket name not configured (set S3_BUCKET_NAME or AWS_STORAGE_BUCKET_NAME)")
    client = _client()
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": BUCKET_NAME, "Key": key},
        ExpiresIn=expires_in,
    )
