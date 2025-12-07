# storage/s3_utils.py
import os, uuid, boto3

S3_BUCKET = os.getenv("AWS_S3_BUCKET")
S3_REGION = os.getenv("AWS_S3_REGION", "us-east-1")
s3 = boto3.client("s3", region_name=S3_REGION)

def build_key(kind, obj_id, filename):
    ext = os.path.splitext(filename)[1] or ".jpg"
    return f"{kind}/{obj_id}/{uuid.uuid4().hex}{ext}"

def presign_upload(key, content_type, expires=300):
    return s3.generate_presigned_url(
        "put_object",
        ExpiresIn=expires,
        Params={
            "Bucket": S3_BUCKET,
            "Key": key,
            "ContentType": content_type,
        },
    )

def presign_download(key, expires=300):
    return s3.generate_presigned_url(
        "get_object",
        ExpiresIn=expires,
        Params={"Bucket": S3_BUCKET, "Key": key},
    )
def presign_get(key: str, expires=300) -> str:
    return s3.generate_presigned_url("get_object", ExpiresIn=expires, Params={"Bucket": S3_BUCKET, "Key": key})
