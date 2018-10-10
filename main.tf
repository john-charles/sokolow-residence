provider "aws" {
  region = "us-east-1"
  profile = "default"
}

resource "aws_s3_bucket" "ecobee-update-bucket" {
  bucket = "ecobee-update-bucket"
  acl = "private"
}

resource "aws_lambda_function" "ecobee-update-lambda" {
  function_name = "ecobee-update-lambda"
  handler = "index.handler"
  role = "${aws_iam_role.ecobee-update-role.arn}"
  runtime = "nodejs8.10"
  filename = "lambda.zip"
  source_code_hash = "${base64sha256(file("lambda.zip"))}"
  environment {
    variables {
      s3Bucket = "${aws_s3_bucket.ecobee-update-bucket.bucket}"
    }
  }

}

resource "aws_lambda_permission" "ecobee-update-cloudwatch-permission" {
  action = "lambda:InvokeFunction"
  principal = "events.amazonaws.com"
  source_arn = "${aws_cloudwatch_event_rule.ecobee-update-rule.arn}"
  function_name = "${aws_lambda_function.ecobee-update-lambda.function_name}"
}


resource "aws_iam_role" "ecobee-update-role" {
  name = "ecobee-update-role"
  assume_role_policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": "sts:AssumeRole",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Effect": "Allow",
      "Sid": ""
    }
  ]
}
EOF
}

resource "aws_iam_role_policy" "ecobee-update-s3-policy" {
  name = "ecobee-update-s3-policy"
  role = "${aws_iam_role.ecobee-update-role.name}"
  policy = <<EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "EcobeeUpdatePolicy",
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:GetObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::ecobee-update-bucket/*"
            ]
        }
    ]
}
EOF
}

resource "aws_iam_role_policy" "ecobee-cloudwatch-policy" {
  policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogStreams"
    ],
      "Resource": [
        "arn:aws:logs:*:*:*"
    ]
  }
 ]
}
EOF
  name = "ecobee-cloudwatch-policy"
  role = "${aws_iam_role.ecobee-update-role.id}"
}

resource "aws_cloudwatch_event_rule" "ecobee-update-rule" {
  name = "ecobee-update-rule"
  schedule_expression = "cron(*/10 * * * ? *)"
  depends_on = [
    "aws_lambda_function.ecobee-update-lambda"]
}

resource "aws_cloudwatch_event_target" "ecobee-update-target" {
  target_id = "ecobee-update-target"
  arn = "${aws_lambda_function.ecobee-update-lambda.arn}"
  rule = "${aws_cloudwatch_event_rule.ecobee-update-rule.name}"
}