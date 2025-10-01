
# E-commerce Analytics Platform




```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend                                 │
│               React App / Postman for Testing                   │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│                  API Gateway                                    │
│            REST API for CRUD operations                         │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│                Lambda Functions                                 │
│  • Product Management  • Order Processing  • Analytics          │
└─────┬───────────────────────────────────────────┬───────────────┘
      │                                           │
      ▼                                           ▼
┌─────────────────────────────┐    ┌────────────────────────────-─┐
│      DynamoDB               │    │    DynamoDB Streams          │
│   (Operational Data)        │────│   (Change Capture)           │
│                             │    │                              │
│ • Products Table            │    │ ┌─────────────────────────┐  │
│ • Orders Table              │    │ │  Stream Processing      │  │
│ • Customers Table           │    │ │     Lambda              │  │
│ • Inventory Table           │    │ └─────────────────────────┘  │
└─────────────────────────────┘    └─────────────┬──────────────-─┘
                                                 │
                                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    RDS PostgreSQL                               │
│                 (Analytics Database)                            │
│                                                                 │
│ • Daily Sales Aggregations                                      │
│ • Product Performance Metrics                                   │
│ • Customer Behavior Analytics                                   │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Amazon Redshift                                │
│                (Data Warehouse)                                 │
│                                                                 │
│ • Historical Sales Data                                         │
│ • Complex Analytics & Reporting                                 │
│ • Business Intelligence Queries                                 │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Amazon QuickSight                              │
│               (Business Intelligence)                           │
│                                                                 │
│ • Sales Dashboards  • Performance Reports  • Trend Analysis     │
└─────────────────────────────────────────────────────────────────┘
```

---



# Implementation
## Set Up Core Infrastructure 

### 1. Create VPC and Security Groups

1. **Create VPC**
    Name: `ecommerce-analytics-vpc` 
    CIDR: 10.0.0.0/16
    Availability Zones: 2
    Public subnets: 2
    Private subnets: 2
    NAT gateways: 1 per AZVPC 
    endpoints: S3
    
2. **Create Security Groups**
    - RDS Security Group:
        Name: `rds-postgres-sg`
        Inbound: Port 5432 from Lambda SG
        Outbound: All traffic
        
    - Lambda Security Group:
        Name: `lambda-functions-sg`
        Outbound: All traffic


### 2. Set Up DynamoDB Tables


1. **Create Products Table**
    Table name: ecommerce-products
    Partition key: `product_id` (String)
    Billing mode: On-demand
    
    Global Secondary Indexes:
    - Index name: `category-product_name-index`
      - Partition key: `category` (String)
      - Sort key: `product_name` (String)
    
    Enable DynamoDB Streams: New and old images
    Enable Point-in-time recovery
    
2. **Create Orders Table**
    Table name: ecommerce-orders
    Partition key: `order_id` (String)
    Sort key: `timestamp` (String)
    Billing mode: On-demand
    
    Global Secondary Indexes:
    - Index name: `customer_id-timestamp-index`
      - Partition key: `customer_id` (String)
      - Sort key: `timestamp` (String)
    
    Enable DynamoDB Streams: New and old images
    Enable Point-in-time recovery
    
3. **Create Customers Table**
    Table name: ecommerce-customers
    Partition key: `customer_id` (String)
    Billing mode: On-demand
    Enable Point-in-time recovery
    
4. **Create Inventory Table**
    Table name: ecommerce-inventory
    Partition key: `product_id` (String)
    Billing mode: On-demand
    Enable Point-in-time recovery




### 3. Create RDS PostgreSQL Instance

- Engine: PostgreSQL
- Version: Latest
- Template: Free tier (for learning)
- DB Instance Identifier: ecommerce-analytics-db
- Master username: `postgres`
- Master password: Create secure password
- DB instance class: db.t3.micro
- Storage: 20 GB
- Storage type: GP2
- VPC: `ecommerce-analytics-vpc`
- Subnet group: Create new private subnet group
- Public access: No
 



## Create Lambda Functions

### 4. Create IAM Roles

1. **Create custom policy for dynamodb**
	
	Name: `ecommerce-dynamodb-policy`
	
    ```json
    {
      "Version": "2012-10-17",
      "Statement": [
        {
          "Effect": "Allow",
          "Action": [
            "dynamodb:PutItem",
            "dynamodb:GetItem",
            "dynamodb:UpdateItem",
            "dynamodb:DeleteItem",
            "dynamodb:Query",
            "dynamodb:Scan",
            "dynamodb:DescribeStream",
	        "dynamodb:GetRecords",
	        "dynamodb:GetShardIterator",
	        "dynamodb:ListStreams",
	        "redshift:DescribeClusters",
	        "redshift:GetClusterCredentials",
	        "redshift-data:ExecuteStatement",
	        "redshift-data:DescribeStatement",
	        "redshift-data:GetStatementResult"
          ],
          "Resource": [
            "arn:aws:dynamodb:*:*:table/ecommerce-*",
            "arn:aws:dynamodb:*:*:table/ecommerce-*/index/*"
          ]
        },
        {
          "Effect": "Allow",
          "Action": [
            "rds:DescribeDBInstances"
          ],
          "Resource": "*"
        }
      ]
    }
    ```
    

1. **Create Lambda Execution Role**
    Role name: ecommerce-lambda-role
    Trust entity: Lambda service
    
    Attach policies:
    - `AWSLambdaBasicExecutionRole`
    - `AWSLambdaVPCAccessExecutionRole`
    - `ecommerce-dynamodb-policy`


### 5. Create Product Management Lambda


1. **Create Function**
    Function name: `ecommerce-product-manager`
    Runtime: Python 3.11
    Execution role: `ecommerce-lambda-role`
    VPC: `ecommerce-analytics-vpc`
    Subnets: Private subnets
    Security groups: `lambda-functions-sg`
    
2. **Function Code:**
    
    ```python
    import json
	import boto3
	from decimal import Decimal
	from datetime import datetime
	import uuid
	
	dynamodb = boto3.resource('dynamodb')
	products_table = dynamodb.Table('ecommerce-products')
	inventory_table = dynamodb.Table('ecommerce-inventory')
	
	# CORS headers to include in all responses
	CORS_HEADERS = {
	    'Access-Control-Allow-Origin': '*',
	    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
	    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
	    'Content-Type': 'application/json'
	}
	
	def lambda_handler(event, context):
	    try:
	        http_method = event['httpMethod']
	        path = event['path']
	        
	        # Handle OPTIONS request for CORS preflight
	        if http_method == 'OPTIONS':
	            return {
	                'statusCode': 200,
	                'headers': CORS_HEADERS,
	                'body': ''
	            }
	        
	        if http_method == 'POST' and path == '/products':
	            return create_product(event)
	        elif http_method == 'GET' and path == '/products':
	            return get_products(event)
	        elif http_method == 'PUT' and '/products/' in path:
	            return update_product(event)
	        elif http_method == 'DELETE' and '/products/' in path:
	            return delete_product(event)
	        else:
	            return {
	                'statusCode': 404,
	                'headers': CORS_HEADERS,
	                'body': json.dumps({'message': 'Not found'})
	            }
	            
	    except Exception as e:
	        return {
	            'statusCode': 500,
	            'headers': CORS_HEADERS,
	            'body': json.dumps({'error': str(e)})
	        }
	
	def create_product(event):
	    data = json.loads(event['body'])
	    product_id = str(uuid.uuid4())
	    
	    # Create product
	    products_table.put_item(
	        Item={
	            'product_id': product_id,
	            'product_name': data['name'],
	            'category': data['category'],
	            'price': Decimal(str(data['price'])),
	            'description': data.get('description', ''),
	            'created_at': datetime.utcnow().isoformat()
	        }
	    )
	    
	    # Initialize inventory
	    inventory_table.put_item(
	        Item={
	            'product_id': product_id,
	            'stock_quantity': data.get('initial_stock', 0),
	            'last_updated': datetime.utcnow().isoformat()
	        }
	    )
	    
	    return {
	        'statusCode': 201,
	        'headers': CORS_HEADERS,
	        'body': json.dumps({'product_id': product_id, 'message': 'Product created successfully'})
	    }
	
	def get_products(event):
	    query_params = event.get('queryStringParameters', {}) or {}
	    
	    if 'category' in query_params:
	        # Query by category using GSI
	        response = products_table.query(
	            IndexName='category-product_name-index',
	            KeyConditionExpression='category = :cat',
	            ExpressionAttributeValues={':cat': query_params['category']}
	        )
	    else:
	        # Scan all products
	        response = products_table.scan()
	    
	    # Convert Decimal to float for JSON serialization
	    items = []
	    for item in response['Items']:
	        item['price'] = float(item['price'])
	        items.append(item)
	    
	    return {
	        'statusCode': 200,
	        'headers': CORS_HEADERS,
	        'body': json.dumps(items)
	    }
	
	def update_product(event):
	    product_id = event['pathParameters']['product_id']
	    data = json.loads(event['body'])
	    
	    update_expression = "SET "
	    expression_values = {}
	    
	    if 'name' in data:
	        update_expression += "product_name = :name, "
	        expression_values[':name'] = data['name']
	    
	    if 'price' in data:
	        update_expression += "price = :price, "
	        expression_values[':price'] = Decimal(str(data['price']))
	    
	    if 'description' in data:
	        update_expression += "description = :desc, "
	        expression_values[':desc'] = data['description']
	    
	    update_expression += "updated_at = :updated"
	    expression_values[':updated'] = datetime.utcnow().isoformat()
	    
	    products_table.update_item(
	        Key={'product_id': product_id},
	        UpdateExpression=update_expression,
	        ExpressionAttributeValues=expression_values
	    )
	    
	    return {
	        'statusCode': 200,
	        'headers': CORS_HEADERS,
	        'body': json.dumps({'message': 'Product updated successfully'})
	    }
	
	def delete_product(event):
	    product_id = event['pathParameters']['product_id']
	    
	    # Delete from products table
	    products_table.delete_item(Key={'product_id': product_id})
	    
	    # Delete from inventory table
	    inventory_table.delete_item(Key={'product_id': product_id})
	    
	    return {
	        'statusCode': 200,
	        'headers': CORS_HEADERS,
	        'body': json.dumps({'message': 'Product deleted successfully'})
	    }
    ```
    

### 6. Create Order Processing Lambda

1. **Create Function**
    Function name: ecommerce-order-processor
    Runtime: Python 3.11
    Execution role: ecommerce-lambda-role
    VPC: `ecommerce-analytics-vpc`
    Subnets: Private subnets
    Security groups: `lambda-functions-sg`
    
    
2. **Function Code:**
    
    ```python
    import json
	import boto3
	from decimal import Decimal
	from datetime import datetime
	import uuid
	
	dynamodb = boto3.resource('dynamodb')
	orders_table = dynamodb.Table('ecommerce-orders')
	customers_table = dynamodb.Table('ecommerce-customers')
	inventory_table = dynamodb.Table('ecommerce-inventory')
	
	# CORS headers to include in all responses
	CORS_HEADERS = {
	    'Access-Control-Allow-Origin': '*',
	    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
	    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
	    'Content-Type': 'application/json'
	}
	
	def lambda_handler(event, context):
	    try:
	        http_method = event['httpMethod']
	        path = event['path']
	        
	        # Handle OPTIONS request for CORS preflight
	        if http_method == 'OPTIONS':
	            return {
	                'statusCode': 200,
	                'headers': CORS_HEADERS,
	                'body': ''
	            }
	        
	        if http_method == 'POST' and path == '/orders':
	            return create_order(event)
	        elif http_method == 'GET' and path == '/orders':
	            return get_orders(event)
	        elif http_method == 'GET' and '/customers/' in path and '/orders' in path:
	            return get_customer_orders(event)
	        else:
	            return {
	                'statusCode': 404,
	                'headers': CORS_HEADERS,
	                'body': json.dumps({'message': 'Not found'})
	            }
	            
	    except Exception as e:
	        return {
	            'statusCode': 500,
	            'headers': CORS_HEADERS,
	            'body': json.dumps({'error': str(e)})
	        }
	
	def create_order(event):
	    # ✅ Parse with Decimal so floats don’t break DynamoDB
	    data = json.loads(event['body'], parse_float=Decimal)
	    order_id = str(uuid.uuid4())
	    timestamp = datetime.utcnow().isoformat()
	    
	    # Calculate total amount safely with Decimal
	    total_amount = sum(item['price'] * item['quantity'] for item in data['items'])
	    
	    # ✅ Ensure all items are Decimal-safe
	    safe_items = []
	    for item in data['items']:
	        safe_items.append({
	            'product_id': item['product_id'],
	            'quantity': int(item['quantity']),  # keep as int
	            'price': item['price']              # already Decimal
	        })
	    
	    # Create order in DynamoDB
	    orders_table.put_item(
	        Item={
	            'order_id': order_id,
	            'timestamp': timestamp,
	            'customer_id': data['customer_id'],
	            'items': safe_items,
	            'total_amount': total_amount,
	            'status': 'pending',
	            'created_at': timestamp
	        }
	    )
	    
	    # Update inventory for each item
	    for item in safe_items:
	        try:
	            inventory_table.update_item(
	                Key={'product_id': item['product_id']},
	                UpdateExpression='SET stock_quantity = stock_quantity - :qty, last_updated = :updated',
	                ExpressionAttributeValues={
	                    ':qty': item['quantity'],
	                    ':updated': timestamp
	                },
	                ConditionExpression='stock_quantity >= :qty'
	            )
	        except dynamodb.meta.client.exceptions.ConditionalCheckFailedException:
	            return {
	                'statusCode': 400,
	                'headers': CORS_HEADERS,
	                'body': json.dumps({'error': f'Insufficient stock for product {item["product_id"]}'})
	            }
	    
	    return {
	        'statusCode': 201,
	        'headers': CORS_HEADERS,
	        # ✅ Convert Decimal back to float for JSON response
	        'body': json.dumps({
	            'order_id': order_id,
	            'total_amount': float(total_amount),
	            'message': 'Order created successfully'
	        })
	    }
	
	def get_orders(event):
	    response = orders_table.scan()
	    
	    # Convert Decimals back to float
	    items = []
	    for item in response['Items']:
	        item['total_amount'] = float(item['total_amount'])
	        for it in item.get('items', []):
	            if isinstance(it.get('price'), Decimal):
	                it['price'] = float(it['price'])
	        items.append(item)
	    
	    return {
	        'statusCode': 200,
	        'headers': CORS_HEADERS,
	        'body': json.dumps(items)
	    }
	
	def get_customer_orders(event):
	    customer_id = event['pathParameters']['customer_id']
	    
	    response = orders_table.query(
	        IndexName='customer_id-timestamp-index',
	        KeyConditionExpression='customer_id = :cid',
	        ExpressionAttributeValues={':cid': customer_id}
	    )
	    
	    # Convert Decimals back to float
	    items = []
	    for item in response['Items']:
	        item['total_amount'] = float(item['total_amount'])
	        for it in item.get('items', []):
	            if isinstance(it.get('price'), Decimal):
	                it['price'] = float(it['price'])
	        items.append(item)
	    
	    return {
	        'statusCode': 200,
	        'headers': CORS_HEADERS,
	        'body': json.dumps(items)
	    }

    ```
    



## Set Up API Gateway 


### 7. Create REST API

1. **Create API**
    API type: REST API
    API name: ecommerce-analytics-api
    Endpoint type: Regional
	
2. Enable CORS
3. **Create Resources and Methods**
    
    **Products Resource:**
    Resource path: /products
    Methods:
    - GET /products → Lambda: ecommerce-product-manager
    - POST /products → Lambda: ecommerce-product-manager
    
    Resource path: /products/{product_id}
    Methods:
    - PUT /products/{product_id} → Lambda: ecommerce-product-manager
    - DELETE /products/{product_id} → Lambda: ecommerce-product-manager
    
    
    **Orders Resource:**
    Resource path: /orders
    Methods:
    - GET /orders → Lambda: ecommerce-order-processor
    - POST /orders → Lambda: ecommerce-order-processor
    
    Resource path: /customers/{customer_id}/orders
    Methods:
    - GET /customers/{customer_id}/orders → Lambda: ecommerce-order-processor
    
    ![[image-5.png]]
    
4. **Deploy API**
    Deployment stage: prod
    Stage description: Production environment
    



## Set Up Analytics Pipeline


### 8. Create Stream Processing Lambda

1. **Create Function**
    Function name: ecommerce-stream-processor
    Runtime: Python 3.11
    Execution role: ecommerce-lambda-role (with RDS permissions)
    VPC: ecommerce-analytics-vpc
    Environment variables:
    - DB_HOST: [RDS endpoint]
    - DB_NAME: ecommerce_analytics
    - DB_USER: postgres
    - DB_PASSWORD: [your password]
    
    
2. **Add RDS Connection Layer** (Create Lambda Layer)
    - Create zip file with psycopg2 library
    - Upload as Lambda layer
    - Attach to function
	
3. **Function Code:**
    
    ```python
    import json
    import os
    import psycopg2
    from datetime import datetime
    
    def lambda_handler(event, context):
        db_host = os.environ['DB_HOST']
        db_name = os.environ['DB_NAME']
        db_user = os.environ['DB_USER']
        db_password = os.environ['DB_PASSWORD']
        
        try:
            # Connect to PostgreSQL
            conn = psycopg2.connect(
                host=db_host,
                database=db_name,
                user=db_user,
                password=db_password
            )
            cursor = conn.cursor()
            
            # Process each record from DynamoDB Stream
            for record in event['Records']:
                if record['eventName'] in ['INSERT', 'MODIFY']:
                    process_record(cursor, record)
            
            conn.commit()
            cursor.close()
            conn.close()
            
            return {'statusCode': 200, 'body': 'Stream processed successfully'}
            
        except Exception as e:
            print(f"Error: {str(e)}")
            return {'statusCode': 500, 'body': f'Error: {str(e)}'}
    
    def process_record(cursor, record):
        table_name = record['eventSourceARN'].split('/')[-3]  # Extract table name
        
        if table_name == 'ecommerce-orders':
            process_order_record(cursor, record)
        elif table_name == 'ecommerce-products':
            process_product_record(cursor, record)
    
    def process_order_record(cursor, record):
        if record['eventName'] == 'INSERT':
            order_data = record['dynamodb']['NewImage']
            
            # Insert into daily_sales table
            cursor.execute("""
                INSERT INTO daily_sales (date, total_orders, total_revenue)
                VALUES (%s, 1, %s)
                ON CONFLICT (date) 
                DO UPDATE SET 
                    total_orders = daily_sales.total_orders + 1,
                    total_revenue = daily_sales.total_revenue + EXCLUDED.total_revenue
            """, (
                datetime.now().date(),
                float(order_data['total_amount']['N'])
            ))
            
            # Insert order details
            cursor.execute("""
                INSERT INTO order_analytics 
                (order_id, customer_id, total_amount, order_date, items_count)
                VALUES (%s, %s, %s, %s, %s)
            """, (
                order_data['order_id']['S'],
                order_data['customer_id']['S'],
                float(order_data['total_amount']['N']),
                order_data['timestamp']['S'],
                len(order_data['items']['L'])
            ))
    
    def process_product_record(cursor, record):
        if record['eventName'] == 'INSERT':
            product_data = record['dynamodb']['NewImage']
            
            # Insert into product_analytics
            cursor.execute("""
                INSERT INTO product_analytics 
                (product_id, product_name, category, price, created_date)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (product_id) DO NOTHING
            """, (
                product_data['product_id']['S'],
                product_data['product_name']['S'],
                product_data['category']['S'],
                float(product_data['price']['N']),
                product_data['created_at']['S']
            ))
    ```
    
1. **Configure DynamoDB Triggers**
    - Go to each DynamoDB table
    - Create trigger pointing to ecommerce-stream-processor Lambda
    - Set batch size: 10
    - Starting position: Latest



### 9. Set Up PostgreSQL Analytics Schema

1. **Connect to RDS PostgreSQL**
	Create public EC2
	Install postgres `sudo yum install postgresql15 -y `
    `psql -h ecommerce-analytics-db.ckr0goam663v.us-east-1.rds.amazonaws.com -p 5432 -U postgres` make sure to put your actual endpoint
	
2. **Create Analytics Tables**
    
    ```sql
    -- Daily sales aggregation
    CREATE TABLE daily_sales (
        date DATE PRIMARY KEY,
        total_orders INTEGER DEFAULT 0,
        total_revenue DECIMAL(10,2) DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Order analytics
    CREATE TABLE order_analytics (
        id SERIAL PRIMARY KEY,
        order_id VARCHAR(255) UNIQUE,
        customer_id VARCHAR(255),
        total_amount DECIMAL(10,2),
        order_date TIMESTAMP,
        items_count INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Product analytics
    CREATE TABLE product_analytics (
        id SERIAL PRIMARY KEY,
        product_id VARCHAR(255) UNIQUE,
        product_name VARCHAR(255),
        category VARCHAR(100),
        price DECIMAL(10,2),
        total_orders INTEGER DEFAULT 0,
        total_revenue DECIMAL(10,2) DEFAULT 0.00,
        created_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Customer analytics
    CREATE TABLE customer_analytics (
        id SERIAL PRIMARY KEY,
        customer_id VARCHAR(255) UNIQUE,
        total_orders INTEGER DEFAULT 0,
        total_spent DECIMAL(10,2) DEFAULT 0.00,
        first_order_date TIMESTAMP,
        last_order_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Create indexes for better query performance
    CREATE INDEX idx_order_analytics_customer ON order_analytics(customer_id);
    CREATE INDEX idx_order_analytics_date ON order_analytics(order_date);
    CREATE INDEX idx_product_analytics_category ON product_analytics(category);
    ```




## Set Up Data Warehouse 

### 10. Create Redshift Cluster

1. **Create Cluster**
    Cluster identifier: `ecommerce-analytics-dwh`
    Node type: ra3.large
    Nodes: 1 
    
    Database name: `ecommerce_dwh`
    Master user: admin
    Master password: [secure password]
    
    VPC: ecommerce-analytics-vpc
    Subnet group: Create new
    Publicly accessible: No
    VPC security groups: Create new (allow access from Lambda)
    
    
2. **Create Data Warehouse Schema**
    make sure to add your endpoint 
    ```psql -h ecommerce-analytics-dwh.cyt1rmfuuvk6.us-east-1.redshift.amazonaws.com \
     -p 5439 \
     -U admin \
     -d ecommerce_dwh```
.
3. **Then type**
    ```sql
    -- Connect to Redshift and create tables
    
    -- Fact table: Sales
    CREATE TABLE fact_sales (
        sale_id BIGINT IDENTITY(1,1) PRIMARY KEY,
        order_id VARCHAR(255),
        product_id VARCHAR(255),
        customer_id VARCHAR(255),
        quantity INTEGER,
        unit_price DECIMAL(10,2),
        total_amount DECIMAL(10,2),
        sale_date DATE,
        sale_timestamp TIMESTAMP
    );
    
    -- Dimension table: Products
    CREATE TABLE dim_products (
        product_id VARCHAR(255) PRIMARY KEY,
        product_name VARCHAR(255),
        category VARCHAR(100),
        price DECIMAL(10,2),
        created_date DATE
    );
    
    -- Dimension table: Customers
    CREATE TABLE dim_customers (
        customer_id VARCHAR(255) PRIMARY KEY,
        customer_name VARCHAR(255),
        email VARCHAR(255),
        registration_date DATE
    );
    
    -- Dimension table: Time
    CREATE TABLE dim_time (
        date_key DATE PRIMARY KEY,
        year INTEGER,
        quarter INTEGER,
        month INTEGER,
        week INTEGER,
        day INTEGER,
        day_of_week INTEGER,
        month_name VARCHAR(20),
        quarter_name VARCHAR(10)
    );
    
    -- Aggregate table: Monthly sales summary
    CREATE TABLE agg_monthly_sales (
        year INTEGER,
        month INTEGER,
        category VARCHAR(100),
        total_orders INTEGER,
        total_revenue DECIMAL(12,2),
        avg_order_value DECIMAL(10,2),
        PRIMARY KEY (year, month, category)
    );
    ```



### 11. Set Up Data Pipeline to Redshift

1. **Create Lambda Function for Redshift ETL**
    Function name: `ecommerce-redshift-etl`
    Runtime: Python 3.11
    Execution role: ecommerce-lambda-role (with Redshift permissions)
    Timeout: 15 minutes
    
2. **Function Configuration:**
	Environment Variables needed for `ecommerce-redshift-etl`:
	
	```
	RDS_HOST: [Your RDS endpoint]
	RDS_DB: ecommerce_analytics
	RDS_USER: postgres
	RDS_PASSWORD: [Your secure password]
	REDSHIFT_HOST: [Your Redshift endpoint]
	REDSHIFT_DB: ecommerce_dwh
	REDSHIFT_USER: admin
	REDSHIFT_PASSWORD: [Your secure password]
	REDSHIFT_PORT: 5439
	```
	
1. **Add the code**
```python
import json
import os
import psycopg2
import boto3
from datetime import datetime, timedelta

# Environment variables
RDS_HOST = os.environ['RDS_HOST']
RDS_DB = os.environ['RDS_DB']
RDS_USER = os.environ['RDS_USER']
RDS_PASSWORD = os.environ['RDS_PASSWORD']

REDSHIFT_HOST = os.environ['REDSHIFT_HOST']
REDSHIFT_DB = os.environ['REDSHIFT_DB']
REDSHIFT_USER = os.environ['REDSHIFT_USER']
REDSHIFT_PASSWORD = os.environ['REDSHIFT_PASSWORD']
REDSHIFT_PORT = os.environ.get('REDSHIFT_PORT', '5439')

def lambda_handler(event, context):
    """
    Main Lambda handler for ETL process from RDS PostgreSQL to Redshift
    Runs daily to sync analytics data to data warehouse
    """
    
    rds_conn = None
    redshift_conn = None
    
    try:
        print("Starting ETL process...")
        
        # Connect to RDS PostgreSQL
        print("Connecting to RDS PostgreSQL...")
        rds_conn = psycopg2.connect(
            host=RDS_HOST,
            database=RDS_DB,
            user=RDS_USER,
            password=RDS_PASSWORD,
            port=5432
        )
        
        # Connect to Redshift
        print("Connecting to Redshift...")
        redshift_conn = psycopg2.connect(
            host=REDSHIFT_HOST,
            database=REDSHIFT_DB,
            user=REDSHIFT_USER,
            password=REDSHIFT_PASSWORD,
            port=REDSHIFT_PORT
        )
        
        # Set autocommit for Redshift
        redshift_conn.autocommit = True
        
        # Execute ETL tasks
        load_dimension_products(rds_conn, redshift_conn)
        load_dimension_customers(rds_conn, redshift_conn)
        load_fact_sales(rds_conn, redshift_conn)
        load_monthly_aggregates(rds_conn, redshift_conn)
        generate_time_dimension(redshift_conn)
        
        print("ETL process completed successfully")
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'ETL process completed successfully',
                'timestamp': datetime.utcnow().isoformat()
            })
        }
        
    except Exception as e:
        print(f"Error in ETL process: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e),
                'timestamp': datetime.utcnow().isoformat()
            })
        }
        
    finally:
        if rds_conn:
            rds_conn.close()
            print("RDS connection closed")
        if redshift_conn:
            redshift_conn.close()
            print("Redshift connection closed")


def load_dimension_products(rds_conn, redshift_conn):
    """
    Load product dimension data from RDS to Redshift
    """
    print("Loading product dimension...")
    
    rds_cursor = rds_conn.cursor()
    redshift_cursor = redshift_conn.cursor()
    
    # Extract from RDS
    rds_cursor.execute("""
        SELECT 
            product_id,
            product_name,
            category,
            price,
            created_date
        FROM product_analytics
    """)
    
    products = rds_cursor.fetchall()
    
    # Load into Redshift (upsert logic)
    for product in products:
        redshift_cursor.execute("""
            DELETE FROM dim_products WHERE product_id = %s
        """, (product[0],))
        
        redshift_cursor.execute("""
            INSERT INTO dim_products 
            (product_id, product_name, category, price, created_date)
            VALUES (%s, %s, %s, %s, %s)
        """, product)
    
    print(f"Loaded {len(products)} products into Redshift")
    
    rds_cursor.close()
    redshift_cursor.close()


def load_dimension_customers(rds_conn, redshift_conn):
    """
    Load customer dimension data from RDS to Redshift
    """
    print("Loading customer dimension...")
    
    rds_cursor = rds_conn.cursor()
    redshift_cursor = redshift_conn.cursor()
    
    # Extract from RDS
    rds_cursor.execute("""
        SELECT DISTINCT
            customer_id,
            customer_id as customer_name,
            customer_id || '@example.com' as email,
            first_order_date::date as registration_date
        FROM customer_analytics
    """)
    
    customers = rds_cursor.fetchall()
    
    # Load into Redshift (upsert logic)
    for customer in customers:
        redshift_cursor.execute("""
            DELETE FROM dim_customers WHERE customer_id = %s
        """, (customer[0],))
        
        redshift_cursor.execute("""
            INSERT INTO dim_customers 
            (customer_id, customer_name, email, registration_date)
            VALUES (%s, %s, %s, %s)
        """, customer)
    
    print(f"Loaded {len(customers)} customers into Redshift")
    
    rds_cursor.close()
    redshift_cursor.close()


def load_fact_sales(rds_conn, redshift_conn):
    """
    Load sales fact data from RDS to Redshift
    Only loads new records from the last 2 days
    """
    print("Loading sales facts...")
    
    rds_cursor = rds_conn.cursor()
    redshift_cursor = redshift_conn.cursor()
    
    # Get the last load date from Redshift
    redshift_cursor.execute("""
        SELECT COALESCE(MAX(sale_date), '2020-01-01'::date) 
        FROM fact_sales
    """)
    last_load_date = redshift_cursor.fetchone()[0]
    
    # Extract from RDS (orders from last 2 days)
    cutoff_date = datetime.now() - timedelta(days=2)
    
    rds_cursor.execute("""
        SELECT 
            o.order_id,
            'PRODUCT-001' as product_id,  -- Simplified for demo
            o.customer_id,
            o.items_count as quantity,
            o.total_amount / o.items_count as unit_price,
            o.total_amount,
            o.order_date::date as sale_date,
            o.order_date as sale_timestamp
        FROM order_analytics o
        WHERE o.order_date >= %s
        ORDER BY o.order_date
    """, (cutoff_date,))
    
    sales = rds_cursor.fetchall()
    
    # Load into Redshift
    for sale in sales:
        redshift_cursor.execute("""
            INSERT INTO fact_sales 
            (order_id, product_id, customer_id, quantity, unit_price, 
             total_amount, sale_date, sale_timestamp)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, sale)
    
    print(f"Loaded {len(sales)} sales records into Redshift")
    
    rds_cursor.close()
    redshift_cursor.close()


def load_monthly_aggregates(rds_conn, redshift_conn):
    """
    Calculate and load monthly sales aggregates
    """
    print("Loading monthly aggregates...")
    
    rds_cursor = rds_conn.cursor()
    redshift_cursor = redshift_conn.cursor()
    
    # Calculate monthly aggregates from RDS
    rds_cursor.execute("""
        SELECT 
            EXTRACT(YEAR FROM o.order_date) as year,
            EXTRACT(MONTH FROM o.order_date) as month,
            COALESCE(p.category, 'Unknown') as category,
            COUNT(DISTINCT o.order_id) as total_orders,
            SUM(o.total_amount) as total_revenue,
            AVG(o.total_amount) as avg_order_value
        FROM order_analytics o
        LEFT JOIN product_analytics p ON 1=1  -- Simplified join for demo
        WHERE o.order_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '3 months')
        GROUP BY 1, 2, 3
    """)
    
    aggregates = rds_cursor.fetchall()
    
    # Load into Redshift (replace existing)
    for agg in aggregates:
        redshift_cursor.execute("""
            DELETE FROM agg_monthly_sales 
            WHERE year = %s AND month = %s AND category = %s
        """, (agg[0], agg[1], agg[2]))
        
        redshift_cursor.execute("""
            INSERT INTO agg_monthly_sales 
            (year, month, category, total_orders, total_revenue, avg_order_value)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, agg)
    
    print(f"Loaded {len(aggregates)} monthly aggregate records into Redshift")
    
    rds_cursor.close()
    redshift_cursor.close()


def generate_time_dimension(redshift_conn):
    """
    Generate time dimension data for the current year
    """
    print("Generating time dimension...")
    
    redshift_cursor = redshift_conn.cursor()
    
    # Check if current year is already populated
    current_year = datetime.now().year
    redshift_cursor.execute("""
        SELECT COUNT(*) FROM dim_time WHERE year = %s
    """, (current_year,))
    
    if redshift_cursor.fetchone()[0] > 0:
        print("Time dimension already populated for current year")
        redshift_cursor.close()
        return
    
    # Generate dates for current year
    start_date = datetime(current_year, 1, 1)
    end_date = datetime(current_year, 12, 31)
    
    current_date = start_date
    dates_inserted = 0
    
    while current_date <= end_date:
        quarter = (current_date.month - 1) // 3 + 1
        week = current_date.isocalendar()[1]
        month_names = ['', 'January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December']
        
        redshift_cursor.execute("""
            INSERT INTO dim_time 
            (date_key, year, quarter, month, week, day, day_of_week, 
             month_name, quarter_name)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            current_date.date(),
            current_date.year,
            quarter,
            current_date.month,
            week,
            current_date.day,
            current_date.weekday() + 1,
            month_names[current_date.month],
            f'Q{quarter}'
        ))
        
        dates_inserted += 1
        current_date += timedelta(days=1)
    
    print(f"Generated {dates_inserted} time dimension records")
    redshift_cursor.close()
```
	
2. **Add the Layer psycopg2:**
	Create a deployment package for psycopg2:
	
3. **Configure EventBridge Rule:**
	
	- Rule name: `daily-redshift-etl`
	- Schedule expression: `cron(0 0 * * ? *)` (runs daily at midnight UTC)
	- Target: Lambda function `ecommerce-redshift-etl`
	- Enable the rule


### 12. Test 

Run this python file to test that everything is running correctly

```python
import requests
import json
import time
import random
from datetime import datetime
from typing import List, Dict

# Configuration
API_BASE_URL = "https://ovqgzgx7vj.execute-api.us-east-1.amazonaws.com/prod"
REGION = "us-east-1"

# Color codes for terminal output
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'


def print_section(title):
    print(f"\n{Colors.BLUE}{'='*60}")
    print(f"{title}")
    print(f"{'='*60}{Colors.END}\n")

def print_success(message):
    print(f"{Colors.GREEN}✓ {message}{Colors.END}")

def print_error(message):
    print(f"{Colors.RED}✗ {message}{Colors.END}")  

def print_info(message):
    print(f"{Colors.YELLOW}ℹ {message}{Colors.END}")

# Sample product data
SAMPLE_PRODUCTS = [
    {
        "name": "Laptop Pro 15",
        "category": "Electronics",
        "price": 1299.99,
        "description": "High-performance laptop with 16GB RAM",
        "initial_stock": 50
    },
    {
        "name": "Wireless Mouse",
        "category": "Electronics",
        "price": 29.99,
        "description": "Ergonomic wireless mouse",
        "initial_stock": 100
    },
    {
        "name": "Running Shoes",
        "category": "Sports",
        "price": 89.99,
        "description": "Professional running shoes",
        "initial_stock": 75
    },
    {
        "name": "Coffee Maker",
        "category": "Home & Garden",
        "price": 129.99,
        "description": "Programmable coffee maker",
        "initial_stock": 40
    },
    {
        "name": "Python Programming Book",
        "category": "Books",
        "price": 49.99,
        "description": "Complete guide to Python",
        "initial_stock": 60
    },
    {
        "name": "Yoga Mat",
        "category": "Sports",
        "price": 34.99,
        "description": "Non-slip yoga mat",
        "initial_stock": 80
    },
    {
        "name": "Bluetooth Speaker",
        "category": "Electronics",
        "price": 79.99,
        "description": "Portable bluetooth speaker",
        "initial_stock": 55
    },
    {
        "name": "Office Chair",
        "category": "Home & Garden",
        "price": 249.99,
        "description": "Ergonomic office chair",
        "initial_stock": 30
    }
]

# Generate customer IDs
CUSTOMERS = [f"customer_{i:03d}" for i in range(1, 26)]
  
def test_api_connectivity():
    """Test basic API connectivity"""
    print_section("Testing API Connectivity")
    try:
        response = requests.get(f"{API_BASE_URL}/products", timeout=10)
        if response.status_code in [200, 404]:
            print_success(f"API is reachable (Status: {response.status_code})")
            return True
        else:
            print_error(f"API returned unexpected status: {response.status_code}")
            return False

    except requests.exceptions.RequestException as e:
        print_error(f"Failed to connect to API: {str(e)}")
        return False

def create_products() -> List[str]:
    """Create sample products and return their IDs"""
    print_section("Creating Sample Products")
    product_ids = []
    for idx, product in enumerate(SAMPLE_PRODUCTS, 1):
        try:
            print_info(f"Creating product {idx}/{len(SAMPLE_PRODUCTS)}: {product['name']}")
            response = requests.post(
                f"{API_BASE_URL}/products",
                json=product,
                headers={'Content-Type': 'application/json'},
                timeout=10
            )
            if response.status_code == 201:
                result = response.json()
                product_id = result.get('product_id')
                product_ids.append(product_id)
                print_success(f"Created: {product['name']} (ID: {product_id[:8]}...)")
            else:
                print_error(f"Failed to create {product['name']}: {response.status_code} - {response.text}")

        except Exception as e:
            print_error(f"Error creating {product['name']}: {str(e)}")
        time.sleep(0.5)  

    print_info(f"\nTotal products created: {len(product_ids)}/{len(SAMPLE_PRODUCTS)}")
    return product_ids


def get_all_products() -> List[Dict]:
    """Retrieve all products"""
    print_section("Retrieving All Products")
    try:
        response = requests.get(f"{API_BASE_URL}/products", timeout=10)
        if response.status_code == 200:
            products = response.json()
            print_success(f"Retrieved {len(products)} products")
            # Display summary
            for product in products[:5]:  # Show first 5
                print(f"  - {product.get('product_name', 'N/A')} | "
                      f"${product.get('price', 0)} | "
                      f"Category: {product.get('category', 'N/A')}")
            if len(products) > 5:
                print(f"  ... and {len(products) - 5} more")
            return products
        else:
            print_error(f"Failed to retrieve products: {response.status_code}")
            return []
    except Exception as e:
        print_error(f"Error retrieving products: {str(e)}")
        return []


def test_category_query():
    """Test querying products by category"""
    print_section("Testing Category Query")
    test_category = "Electronics"
    try:
        response = requests.get(
            f"{API_BASE_URL}/products",
            params={'category': test_category},
            timeout=10
        )
        if response.status_code == 200:
            products = response.json()
            print_success(f"Found {len(products)} products in '{test_category}' category")
            for product in products:
                print(f"  - {product.get('product_name', 'N/A')} (${product.get('price', 0)})")
        else:
            print_error(f"Category query failed: {response.status_code}")
    except Exception as e:
        print_error(f"Error querying category: {str(e)}")

def create_orders(product_ids: List[str], num_orders: int = 20):
    """Create sample orders"""
    print_section(f"Creating {num_orders} Sample Orders")
    if not product_ids:
        print_error("No product IDs available for creating orders")
        return []
    order_ids = []
    for i in range(num_orders):
        try:
            # Random customer
            customer_id = random.choice(CUSTOMERS)
            # Random number of items (1-3)
            num_items = random.randint(1, 3)
            items = []
            for _ in range(num_items):
                product_id = random.choice(product_ids)
                quantity = random.randint(1, 3)

                price = round(random.uniform(20, 500), 2)

                items.append({

                    "product_id": product_id,

                    "quantity": quantity,

                    "price": price

                })

            order_data = {

                "customer_id": customer_id,

                "items": items

            }

            response = requests.post(

                f"{API_BASE_URL}/orders",

                json=order_data,

                headers={'Content-Type': 'application/json'},

                timeout=10

            )

            if response.status_code == 201:

                result = response.json()

                order_id = result.get('order_id')

                order_ids.append(order_id)

                total = result.get('total_amount', 0)

                print_success(f"Order {i+1}/{num_orders}: {order_id[:8]}... | "

                            f"Customer: {customer_id} | "

                            f"Items: {len(items)} | "

                            f"Total: ${total:.2f}")

            else:

                print_error(f"Order {i+1} failed: {response.status_code} - {response.text}")

        except Exception as e:

            print_error(f"Error creating order {i+1}: {str(e)}")

        time.sleep(0.5)  # Rate limiting

    print_info(f"\nTotal orders created: {len(order_ids)}/{num_orders}")

    return order_ids

  

def get_all_orders():

    """Retrieve all orders"""

    print_section("Retrieving All Orders")

    try:

        response = requests.get(f"{API_BASE_URL}/orders", timeout=10)

        if response.status_code == 200:

            orders = response.json()

            print_success(f"Retrieved {len(orders)} orders")

            # Calculate total revenue

            total_revenue = sum(order.get('total_amount', 0) for order in orders)

            print_info(f"Total Revenue: ${total_revenue:.2f}")

            # Display sample orders

            for order in orders[:5]:

                print(f"  - Order: {order.get('order_id', 'N/A')[:8]}... | "

                      f"Customer: {order.get('customer_id', 'N/A')[:12]}... | "

                      f"Total: ${order.get('total_amount', 0):.2f}")

            if len(orders) > 5:

                print(f"  ... and {len(orders) - 5} more")

            return orders

        else:

            print_error(f"Failed to retrieve orders: {response.status_code}")

            return []

    except Exception as e:

        print_error(f"Error retrieving orders: {str(e)}")

        return []

  

def get_customer_orders(customer_id: str):

    """Retrieve orders for a specific customer"""

    print_section(f"Retrieving Orders for Customer: {customer_id}")

    try:

        response = requests.get(

            f"{API_BASE_URL}/customers/{customer_id}/orders",

            timeout=10

        )

        if response.status_code == 200:

            orders = response.json()

            print_success(f"Found {len(orders)} orders for {customer_id}")

            total_spent = sum(order.get('total_amount', 0) for order in orders)

            print_info(f"Total spent by customer: ${total_spent:.2f}")

            for order in orders:

                print(f"  - {order.get('order_id', 'N/A')[:8]}... | "

                      f"${order.get('total_amount', 0):.2f} | "

                      f"{order.get('status', 'N/A')}")

        else:

            print_error(f"Failed to retrieve customer orders: {response.status_code}")

    except Exception as e:

        print_error(f"Error retrieving customer orders: {str(e)}")

  

def delete_sample_product(product_id: str):

    """Test product deletion"""

    print_section("Testing Product Deletion")

    try:

        response = requests.delete(

            f"{API_BASE_URL}/products/{product_id}",

            timeout=10

        )

        if response.status_code == 200:

            print_success(f"Successfully deleted product: {product_id[:8]}...")

        else:

            print_error(f"Failed to delete product: {response.status_code}")

    except Exception as e:

        print_error(f"Error deleting product: {str(e)}")

  

def generate_analytics_summary(orders: List[Dict]):

    """Generate analytics summary from orders"""

    print_section("Analytics Summary")

    if not orders:

        print_info("No orders available for analytics")

        return

    # Calculate metrics

    total_orders = len(orders)

    total_revenue = sum(order.get('total_amount', 0) for order in orders)

    avg_order_value = total_revenue / total_orders if total_orders > 0 else 0

    # Unique customers

    unique_customers = len(set(order.get('customer_id') for order in orders))

    print_success(f"Total Orders: {total_orders}")

    print_success(f"Total Revenue: ${total_revenue:.2f}")

    print_success(f"Average Order Value: ${avg_order_value:.2f}")

    print_success(f"Unique Customers: {unique_customers}")

  

def main():

    """Main test execution"""

    print(f"\n{Colors.BLUE}")

    print("╔═══════════════════════════════════════════════════════════╗")

    print("║   E-commerce Analytics Platform - Comprehensive Test     ║")

    print("╚═══════════════════════════════════════════════════════════╝")

    print(f"{Colors.END}")

    print_info(f"API Endpoint: {API_BASE_URL}")

    print_info(f"Region: {REGION}")

    print_info(f"Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    # Test 1: API Connectivity

    if not test_api_connectivity():

        print_error("Cannot proceed without API connectivity")

        return

    time.sleep(1)

    # Test 2: Create Products

    product_ids = create_products()

    time.sleep(2)

    # Test 3: Retrieve Products

    products = get_all_products()

    time.sleep(1)

    # Test 4: Test Category Query

    test_category_query()

    time.sleep(1)

    # Test 5: Create Orders

    order_ids = create_orders(product_ids, num_orders=20)

    time.sleep(2)

    # Test 6: Retrieve Orders

    orders = get_all_orders()

    time.sleep(1)

    # Test 7: Analytics Summary

    generate_analytics_summary(orders)

    # Test 8: Delete Product (optional - commented out to preserve data)

    if product_ids:

        delete_sample_product(product_ids[0])

    # Final Summary

    print_section("Test Execution Complete")

    print_success("All tests completed successfully!")

    print_info("\nNext Steps:")

    print("  1. Check DynamoDB tables for created data")

    print("  2. Verify DynamoDB Streams triggered Lambda")

    print("  3. Check RDS PostgreSQL for analytics data")

    print("  4. Run Redshift ETL Lambda or wait for scheduled execution")

    print("  5. Query Redshift data warehouse tables")

    print("\nData Pipeline Check:")

    print("  - DynamoDB → Streams → Lambda → RDS PostgreSQL (real-time)")

    print("  - RDS PostgreSQL → Lambda ETL → Redshift (daily)")

  

if __name__ == "__main__":

    try:

        main()

    except KeyboardInterrupt:

        print_error("\n\nTest interrupted by user")

    except Exception as e:

        print_error(f"\n\nUnexpected error: {str(e)}")
```



## Deploy the website to AWS Amplify

### 12. Prepare Repository

1. Create a new folder on your machine
2. Create this file `setup.sh`
		
```
#!/bin/bash

# ============================================================================
# E-commerce Analytics Dashboard - AWS Amplify Compatible Setup Script
# ============================================================================

echo "Starting E-commerce Dashboard Setup..."

# Step 1: Create React App
echo "Creating React application..."
npx create-react-app ecommerce-dashboard
cd ecommerce-dashboard

# Step 2: Install Dependencies 
echo "Installing dependencies..."
npm install lucide-react

# Step 3: Update index.css
echo "Updating styles..."
cat > src/index.css << 'EOF'
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

code {
  font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New',
    monospace;
}
EOF

# Step 4: Update .gitignore
echo "Updating .gitignore..."
cat > .gitignore << 'EOF'
# See https://help.github.com/articles/ignoring-files/ for more about ignoring files.

# dependencies
/node_modules
/.pnp
.pnp.js

# testing
/coverage

# production
/build

# misc
.DS_Store
.env.local
.env.development.local
.env.test.local
.env.production.local

npm-debug.log*
yarn-debug.log*
yarn-error.log*
EOF

# Step 5: Create environment file template
echo "Creating environment template..."
cat > .env.example << 'EOF'
REACT_APP_API_ENDPOINT=https://your-api-id.execute-api.us-east-1.amazonaws.com/prod
EOF

# Step 6: Delete any Tailwind config files (if they exist)
echo "Removing any existing Tailwind configuration..."
rm -f tailwind.config.js
rm -f postcss.config.js

# Step 7: Initialize Git
echo "Initializing Git repository..."
git init
git branch -M main

# Step 8: Display next steps
echo ""
echo "Setup completed successfully!"
echo ""
echo "Next steps:"
echo "1. Replace src/App.js with the dashboard code provided"
echo "2. Replace src/App.css with the CSS file provided"
echo "3. Update your API endpoint in the application header"
echo "4. Test locally: npm start"
echo "5. Commit to Git:"
echo "   git add ."
echo "   git commit -m 'Initial commit'"
echo "6. Create GitHub repository and push:"
echo "   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git"
echo "   git push -u origin main"
echo "7. Deploy to AWS Amplify:"
echo "   - Go to AWS Amplify Console"
echo "   - Click 'New app' > 'Host web app'"
echo "   - Connect your GitHub repository"
echo "   - Deploy!"
echo ""
echo "To test locally now, run: cd ecommerce-dashboard && npm start"
echo ""
```
	
1. Run it 
2. Replace the code in App.js with
```js

import React, { useState, useEffect } from 'react';

import { Package, ShoppingCart, Users, TrendingUp, Database, Plus, Trash2, BarChart3 } from 'lucide-react';

import './App.css';

  

function App() {

  const [activeTab, setActiveTab] = useState('overview');

  const [apiEndpoint, setApiEndpoint] = useState('https://ovqgzgx7vj.execute-api.us-east-1.amazonaws.com/prod');

  const [products, setProducts] = useState([]);

  const [orders, setOrders] = useState([]);

  const [loading, setLoading] = useState(false);

  const [showProductForm, setShowProductForm] = useState(false);

  const [showOrderForm, setShowOrderForm] = useState(false);

  const [newProduct, setNewProduct] = useState({ name: '', category: '', price: '', description: '', initial_stock: '' });

  const [newOrder, setNewOrder] = useState({ customer_id: '', items: [{ product_id: '', quantity: 1, price: 0 }] });

  

  const [stats, setStats] = useState({

    totalProducts: 0,

    totalOrders: 0,

    totalRevenue: 0,

    activeCustomers: 0

  });

  

  useEffect(() => {

    if (products.length > 0 || orders.length > 0) {

      setStats({

        totalProducts: products.length,

        totalOrders: orders.length,

        totalRevenue: orders.reduce((sum, order) => sum + (order.total_amount || 0), 0),

        activeCustomers: new Set(orders.map(o => o.customer_id)).size

      });

    }

  }, [products, orders]);

  

  const fetchProducts = async () => {

    setLoading(true);

    try {

      const response = await fetch(`${apiEndpoint}/products`);

      if (response.ok) {

        const data = await response.json();

        setProducts(data);

      } else {

        alert('Error fetching products. Check your API endpoint and CORS settings.');

      }

    } catch (error) {

      console.error('Error fetching products:', error);

      alert('Error fetching products. Check your API endpoint.');

    }

    setLoading(false);

  };

  

  const fetchOrders = async () => {

    setLoading(true);

    try {

      const response = await fetch(`${apiEndpoint}/orders`);

      if (response.ok) {

        const data = await response.json();

        setOrders(data);

      } else {

        alert('Error fetching orders. Check your API endpoint and CORS settings.');

      }

    } catch (error) {

      console.error('Error fetching orders:', error);

      alert('Error fetching orders. Check your API endpoint.');

    }

    setLoading(false);

  };

  

  const createProduct = async () => {

    if (!newProduct.name || !newProduct.category || !newProduct.price) {

      alert('Please fill in all required fields');

      return;

    }

  

    setLoading(true);

    try {

      const response = await fetch(`${apiEndpoint}/products`, {

        method: 'POST',

        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify({

          name: newProduct.name,

          category: newProduct.category,

          price: parseFloat(newProduct.price),

          description: newProduct.description,

          initial_stock: parseInt(newProduct.initial_stock) || 0

        })

      });

      if (response.ok) {

        alert('Product created successfully!');

        setShowProductForm(false);

        setNewProduct({ name: '', category: '', price: '', description: '', initial_stock: '' });

        fetchProducts();

      } else {

        alert('Error creating product. Check console for details.');

      }

    } catch (error) {

      console.error('Error creating product:', error);

      alert('Error creating product.');

    }

    setLoading(false);

  };

  

  const deleteProduct = async (productId) => {

    if (!window.confirm('Are you sure you want to delete this product?')) return;

    setLoading(true);

    try {

      const response = await fetch(`${apiEndpoint}/products/${productId}`, {

        method: 'DELETE'

      });

      if (response.ok) {

        alert('Product deleted successfully!');

        fetchProducts();

      } else {

        alert('Error deleting product.');

      }

    } catch (error) {

      console.error('Error deleting product:', error);

      alert('Error deleting product.');

    }

    setLoading(false);

  };

  

  const createOrder = async () => {

    if (!newOrder.customer_id || newOrder.items.length === 0) {

      alert('Please fill in all required fields');

      return;

    }

  

    setLoading(true);

    try {

      const response = await fetch(`${apiEndpoint}/orders`, {

        method: 'POST',

        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify({

          customer_id: newOrder.customer_id,

          items: newOrder.items.map(item => ({

            product_id: item.product_id,

            quantity: parseInt(item.quantity),

            price: parseFloat(item.price)

          }))

        })

      });

      if (response.ok) {

        alert('Order created successfully!');

        setShowOrderForm(false);

        setNewOrder({ customer_id: '', items: [{ product_id: '', quantity: 1, price: 0 }] });

        fetchOrders();

      } else {

        alert('Error creating order. Check console for details.');

      }

    } catch (error) {

      console.error('Error creating order:', error);

      alert('Error creating order.');

    }

    setLoading(false);

  };

  

  const addOrderItem = () => {

    setNewOrder({

      ...newOrder,

      items: [...newOrder.items, { product_id: '', quantity: 1, price: 0 }]

    });

  };

  

  const updateOrderItem = (index, field, value) => {

    const items = [...newOrder.items];

    items[index][field] = value;

    setNewOrder({ ...newOrder, items });

  };

  

  return (

    <div className="app-container">

      <header className="header">

        <div className="header-content">

          <div className="header-left">

            <Database className="header-icon" size={32} />

            <div>

              <h1 className="header-title">E-commerce Analytics Platform</h1>

              <p className="header-subtitle">AWS Cloud Infrastructure</p>

            </div>

          </div>

          <div className="header-right">

            <input

              type="text"

              value={apiEndpoint}

              onChange={(e) => setApiEndpoint(e.target.value)}

              placeholder="API Gateway Endpoint"

              className="api-input"

            />

          </div>

        </div>

      </header>

  

      <div className="tabs-container">

        <div className="tabs">

          {[

            { id: 'overview', label: 'Overview', icon: BarChart3 },

            { id: 'products', label: 'Products', icon: Package },

            { id: 'orders', label: 'Orders', icon: ShoppingCart },

            { id: 'architecture', label: 'Architecture', icon: TrendingUp }

          ].map(tab => (

            <button

              key={tab.id}

              onClick={() => setActiveTab(tab.id)}

              className={`tab ${activeTab === tab.id ? 'tab-active' : ''}`}

            >

              <tab.icon size={20} />

              {tab.label}

            </button>

          ))}

        </div>

      </div>

  

      <main className="main-content">

        {activeTab === 'overview' && (

          <div className="content-section">

            <div className="stats-grid">

              {[

                { label: 'Total Products', value: stats.totalProducts, icon: Package, color: 'blue' },

                { label: 'Total Orders', value: stats.totalOrders, icon: ShoppingCart, color: 'green' },

                { label: 'Total Revenue', value: `$${stats.totalRevenue.toFixed(2)}`, icon: TrendingUp, color: 'purple' },

                { label: 'Active Customers', value: stats.activeCustomers, icon: Users, color: 'orange' }

              ].map((stat, idx) => (

                <div key={idx} className={`stat-card stat-${stat.color}`}>

                  <stat.icon size={32} className="stat-icon" />

                  <p className="stat-value">{stat.value}</p>

                  <p className="stat-label">{stat.label}</p>

                </div>

              ))}

            </div>

  

            <div className="card">

              <h2 className="card-title">Quick Actions</h2>

              <div className="actions-grid">

                <button onClick={fetchProducts} disabled={loading} className="btn btn-blue">

                  <Package size={20} />

                  {loading ? 'Loading...' : 'Load Products'}

                </button>

                <button onClick={fetchOrders} disabled={loading} className="btn btn-green">

                  <ShoppingCart size={20} />

                  {loading ? 'Loading...' : 'Load Orders'}

                </button>

                <button onClick={() => setShowProductForm(true)} className="btn btn-purple">

                  <Plus size={20} />

                  Create Product

                </button>

              </div>

            </div>

          </div>

        )}

  

        {activeTab === 'products' && (

          <div className="content-section">

            <div className="section-header">

              <h2 className="section-title">Products Management</h2>

              <button onClick={() => setShowProductForm(true)} className="btn btn-blue">

                <Plus size={20} />

                Add Product

              </button>

            </div>

  

            {showProductForm && (

              <div className="card">

                <h3 className="card-title">New Product</h3>

                <div className="form-grid">

                  <input

                    type="text"

                    placeholder="Product Name *"

                    value={newProduct.name}

                    onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}

                    className="input"

                  />

                  <input

                    type="text"

                    placeholder="Category *"

                    value={newProduct.category}

                    onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}

                    className="input"

                  />

                  <input

                    type="number"

                    placeholder="Price *"

                    value={newProduct.price}

                    onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}

                    className="input"

                  />

                  <input

                    type="number"

                    placeholder="Initial Stock"

                    value={newProduct.initial_stock}

                    onChange={(e) => setNewProduct({ ...newProduct, initial_stock: e.target.value })}

                    className="input"

                  />

                  <input

                    type="text"

                    placeholder="Description"

                    value={newProduct.description}

                    onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}

                    className="input input-full"

                  />

                </div>

                <div className="form-actions">

                  <button onClick={createProduct} disabled={loading} className="btn btn-blue">

                    {loading ? 'Creating...' : 'Create Product'}

                  </button>

                  <button onClick={() => setShowProductForm(false)} className="btn btn-gray">

                    Cancel

                  </button>

                </div>

              </div>

            )}

  

            <div className="card">

              <div className="table-container">

                <table className="table">

                  <thead>

                    <tr>

                      <th>Product ID</th>

                      <th>Name</th>

                      <th>Category</th>

                      <th>Price</th>

                      <th>Actions</th>

                    </tr>

                  </thead>

                  <tbody>

                    {products.length === 0 ? (

                      <tr>

                        <td colSpan="5" className="table-empty">

                          No products loaded. Click "Load Products" to fetch data.

                        </td>

                      </tr>

                    ) : (

                      products.map(product => (

                        <tr key={product.product_id}>

                          <td className="table-id">{product.product_id.substring(0, 8)}...</td>

                          <td>{product.product_name}</td>

                          <td>{product.category}</td>

                          <td className="table-price">${product.price}</td>

                          <td>

                            <button onClick={() => deleteProduct(product.product_id)} className="btn-icon btn-danger">

                              <Trash2 size={16} />

                            </button>

                          </td>

                        </tr>

                      ))

                    )}

                  </tbody>

                </table>

              </div>

            </div>

          </div>

        )}

  

        {activeTab === 'orders' && (

          <div className="content-section">

            <div className="section-header">

              <h2 className="section-title">Orders Management</h2>

              <button onClick={() => setShowOrderForm(true)} className="btn btn-green">

                <Plus size={20} />

                Create Order

              </button>

            </div>

  

            {showOrderForm && (

              <div className="card">

                <h3 className="card-title">New Order</h3>

                <input

                  type="text"

                  placeholder="Customer ID *"

                  value={newOrder.customer_id}

                  onChange={(e) => setNewOrder({ ...newOrder, customer_id: e.target.value })}

                  className="input"

                  style={{marginBottom: '1rem'}}

                />

                <div style={{marginBottom: '1rem'}}>

                  <label className="form-label">Order Items</label>

                  {newOrder.items.map((item, idx) => (

                    <div key={idx} className="order-item-row">

                      <input

                        type="text"

                        placeholder="Product ID"

                        value={item.product_id}

                        onChange={(e) => updateOrderItem(idx, 'product_id', e.target.value)}

                        className="input"

                      />

                      <input

                        type="number"

                        placeholder="Quantity"

                        value={item.quantity}

                        onChange={(e) => updateOrderItem(idx, 'quantity', e.target.value)}

                        className="input"

                      />

                      <input

                        type="number"

                        placeholder="Price"

                        value={item.price}

                        onChange={(e) => updateOrderItem(idx, 'price', e.target.value)}

                        className="input"

                      />

                    </div>

                  ))}

                  <button onClick={addOrderItem} className="btn-link">

                    + Add Another Item

                  </button>

                </div>

                <div className="form-actions">

                  <button onClick={createOrder} disabled={loading} className="btn btn-green">

                    {loading ? 'Creating...' : 'Create Order'}

                  </button>

                  <button onClick={() => setShowOrderForm(false)} className="btn btn-gray">

                    Cancel

                  </button>

                </div>

              </div>

            )}

  

            <div className="card">

              <div className="table-container">

                <table className="table">

                  <thead>

                    <tr>

                      <th>Order ID</th>

                      <th>Customer ID</th>

                      <th>Items</th>

                      <th>Total</th>

                      <th>Status</th>

                      <th>Date</th>

                    </tr>

                  </thead>

                  <tbody>

                    {orders.length === 0 ? (

                      <tr>

                        <td colSpan="6" className="table-empty">

                          No orders loaded. Click "Load Orders" to fetch data.

                        </td>

                      </tr>

                    ) : (

                      orders.map(order => (

                        <tr key={order.order_id}>

                          <td className="table-id">{order.order_id.substring(0, 8)}...</td>

                          <td className="table-id">{order.customer_id.substring(0, 8)}...</td>

                          <td>{order.items?.length || 0} items</td>

                          <td className="table-price">${order.total_amount?.toFixed(2)}</td>

                          <td>

                            <span className={`badge badge-${order.status === 'pending' ? 'yellow' : 'green'}`}>

                              {order.status}

                            </span>

                          </td>

                          <td>{new Date(order.timestamp).toLocaleDateString()}</td>

                        </tr>

                      ))

                    )}

                  </tbody>

                </table>

              </div>

            </div>

          </div>

        )}

  

        {activeTab === 'architecture' && (

          <div className="content-section">

            <h2 className="section-title">System Architecture</h2>

            <div className="card">

              <h3 className="card-title">AWS Services Used</h3>

              <div className="services-grid">

                {[

                  { name: 'API Gateway', desc: 'REST API' },

                  { name: 'Lambda', desc: '5 Functions' },

                  { name: 'DynamoDB', desc: '4 Tables' },

                  { name: 'RDS PostgreSQL', desc: 'Analytics DB' },

                  { name: 'Redshift', desc: 'Data Warehouse' },

                  { name: 'VPC', desc: 'Network' },

                  { name: 'IAM', desc: 'Security' },

                  { name: 'CloudWatch', desc: 'Monitoring' }

                ].map((service, idx) => (

                  <div key={idx} className="service-card">

                    <p className="service-name">{service.name}</p>

                    <p className="service-desc">{service.desc}</p>

                  </div>

                ))}

              </div>

            </div>

  

            <div className="card">

              <h3 className="card-title">Lambda Functions</h3>

              <div className="functions-list">

                {[

                  {

                    name: 'ecommerce-product-manager',

                    desc: 'Handles product CRUD operations',

                    endpoints: ['GET /products', 'POST /products', 'PUT /products/{id}', 'DELETE /products/{id}']

                  },

                  {

                    name: 'ecommerce-order-processor',

                    desc: 'Manages order creation and retrieval',

                    endpoints: ['GET /orders', 'POST /orders', 'GET /customers/{id}/orders']

                  },

                  {

                    name: 'ecommerce-stream-processor',

                    desc: 'Processes DynamoDB streams to RDS PostgreSQL',

                    endpoints: ['Triggered by DynamoDB Streams']

                  },

                  {

                    name: 'ecommerce-redshift-etl',

                    desc: 'Daily ETL from RDS to Redshift data warehouse',

                    endpoints: ['Scheduled via EventBridge (daily at midnight)']

                  }

                ].map((func, idx) => (

                  <div key={idx} className="function-card">

                    <p className="function-name">{func.name}</p>

                    <p className="function-desc">{func.desc}</p>

                    <div className="endpoints">

                      {func.endpoints.map((endpoint, eidx) => (

                        <span key={eidx} className="endpoint">{endpoint}</span>

                      ))}

                    </div>

                  </div>

                ))}

              </div>

            </div>

  

            <div className="architecture-grid">

              <div className="card">

                <h3 className="card-title">

                  <Database size={24} style={{display: 'inline', marginRight: '0.5rem'}} />

                  Data Flow

                </h3>

                <div className="data-flow">

                  {[

                    { num: 1, title: 'API Gateway', desc: 'REST API receives CRUD operations' },

                    { num: 2, title: 'Lambda Functions', desc: 'Process business logic and data operations' },

                    { num: 3, title: 'DynamoDB', desc: 'Store operational data with streams enabled' },

                    { num: 4, title: 'Stream Processing', desc: 'Lambda processes changes to RDS PostgreSQL' },

                    { num: 5, title: 'ETL to Redshift', desc: 'Daily batch processing to data warehouse' }

                  ].map((step) => (

                    <div key={step.num} className="flow-step">

                      <div className="flow-number">{step.num}</div>

                      <div>

                        <p className="flow-title">{step.title}</p>

                        <p className="flow-desc">{step.desc}</p>

                      </div>

                    </div>

                  ))}

                </div>

              </div>

  

              <div className="card card-instructions">

                <h3 className="card-title">Setup Instructions</h3>

                <ol className="instructions-list">

                  <li>Update the API Gateway Endpoint in the header</li>

                  <li>Ensure all Lambda functions are deployed and API Gateway is configured</li>

                  <li>Create DynamoDB tables with streams enabled</li>

                  <li>Set up RDS PostgreSQL and run schema creation scripts</li>

                  <li>Configure Redshift cluster and create warehouse tables</li>

                  <li>Deploy the Redshift ETL Lambda with EventBridge schedule</li>

                </ol>

              </div>

            </div>

          </div>

        )}

      </main>

  

      <footer className="footer">

        <div className="footer-content">

          <p>E-commerce Analytics Platform - AWS Cloud Architecture</p>

          <p>Built with React + API Gateway + Lambda + DynamoDB + RDS + Redshift</p>

        </div>

      </footer>

    </div>

  );

}

  

export default App;
```

And replace `app.css` with

```css
* {

  margin: 0;

  padding: 0;

  box-sizing: border-box;

}

  

body {

  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',

    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',

    sans-serif;

  -webkit-font-smoothing: antialiased;

  -moz-osx-font-smoothing: grayscale;

}

  

.app-container {

  min-height: 100vh;

  background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #0f172a 100%);

}

  

/* Header */

.header {

  background: rgba(30, 41, 59, 0.5);

  backdrop-filter: blur(10px);

  border-bottom: 1px solid rgba(71, 85, 105, 0.5);

  position: sticky;

  top: 0;

  z-index: 50;

}

  

.header-content {

  max-width: 1280px;

  margin: 0 auto;

  padding: 1rem 1.5rem;

  display: flex;

  align-items: center;

  justify-content: space-between;

  gap: 1rem;

  flex-wrap: wrap;

}

  

.header-left {

  display: flex;

  align-items: center;

  gap: 0.75rem;

}

  

.header-icon {

  color: #60a5fa;

  flex-shrink: 0;

}

  

.header-title {

  font-size: 1.5rem;

  font-weight: bold;

  color: white;

}

  

.header-subtitle {

  font-size: 0.875rem;

  color: #94a3b8;

}

  

.header-right {

  display: flex;

  align-items: center;

  gap: 0.5rem;

}

  

.api-input {

  padding: 0.5rem 1rem;

  background: #334155;

  color: white;

  border-radius: 0.5rem;

  border: 1px solid #475569;

  font-size: 0.875rem;

  width: 400px;

  max-width: 100%;

}

  

.api-input:focus {

  outline: none;

  border-color: #60a5fa;

}

  

/* Tabs */

.tabs-container {

  max-width: 1280px;

  margin: 1.5rem auto 0;

  padding: 0 1.5rem;

}

  

.tabs {

  display: flex;

  gap: 0.5rem;

  background: rgba(30, 41, 59, 0.5);

  padding: 0.5rem;

  border-radius: 0.5rem;

  backdrop-filter: blur(10px);

  flex-wrap: wrap;

}

  

.tab {

  display: flex;

  align-items: center;

  gap: 0.5rem;

  padding: 0.75rem 1.5rem;

  border-radius: 0.5rem;

  background: transparent;

  border: none;

  color: #cbd5e1;

  cursor: pointer;

  transition: all 0.2s;

  font-size: 1rem;

}

  

.tab:hover {

  background: #334155;

}

  

.tab-active {

  background: #2563eb;

  color: white;

  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);

}

  

/* Main Content */

.main-content {

  max-width: 1280px;

  margin: 0 auto;

  padding: 2rem 1.5rem;

}

  

.content-section {

  display: flex;

  flex-direction: column;

  gap: 1.5rem;

}

  

/* Stats Grid */

.stats-grid {

  display: grid;

  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));

  gap: 1.5rem;

}

  

.stat-card {

  background: rgba(30, 41, 59, 0.5);

  backdrop-filter: blur(10px);

  padding: 1.5rem;

  border-radius: 0.75rem;

  border: 1px solid rgba(71, 85, 105, 0.5);

  transition: all 0.2s;

}

  

.stat-card:hover {

  border-color: #475569;

}

  

.stat-icon {

  margin-bottom: 0.5rem;

}

  

.stat-blue .stat-icon { color: #60a5fa; }

.stat-green .stat-icon { color: #34d399; }

.stat-purple .stat-icon { color: #a78bfa; }

.stat-orange .stat-icon { color: #fb923c; }

  

.stat-value {

  font-size: 2rem;

  font-weight: bold;

  color: white;

  margin-bottom: 0.25rem;

}

  

.stat-label {

  font-size: 0.875rem;

  color: #94a3b8;

}

  

/* Card */

.card {

  background: rgba(30, 41, 59, 0.5);

  backdrop-filter: blur(10px);

  padding: 1.5rem;

  border-radius: 0.75rem;

  border: 1px solid rgba(71, 85, 105, 0.5);

}

  

.card-title {

  font-size: 1.25rem;

  font-weight: bold;

  color: white;

  margin-bottom: 1rem;

}

  

.card-instructions {

  background: linear-gradient(135deg, rgba(37, 99, 235, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%);

  border-color: rgba(59, 130, 246, 0.3);

}

  

/* Actions Grid */

.actions-grid {

  display: grid;

  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));

  gap: 1rem;

}

  

/* Buttons */

.btn {

  display: flex;

  align-items: center;

  justify-content: center;

  gap: 0.5rem;

  padding: 1rem 1.5rem;

  border-radius: 0.5rem;

  border: none;

  font-size: 1rem;

  font-weight: 500;

  cursor: pointer;

  transition: all 0.2s;

  color: white;

}

  

.btn:disabled {

  opacity: 0.5;

  cursor: not-allowed;

}

  

.btn-blue {

  background: #2563eb;

}

  

.btn-blue:hover:not(:disabled) {

  background: #1d4ed8;

}

  

.btn-green {

  background: #059669;

}

  

.btn-green:hover:not(:disabled) {

  background: #047857;

}

  

.btn-purple {

  background: #7c3aed;

}

  

.btn-purple:hover:not(:disabled) {

  background: #6d28d9;

}

  

.btn-gray {

  background: #475569;

}

  

.btn-gray:hover {

  background: #334155;

}

  

.btn-icon {

  padding: 0.5rem;

  border: none;

  background: transparent;

  cursor: pointer;

  border-radius: 0.25rem;

  transition: all 0.2s;

  display: flex;

  align-items: center;

  justify-content: center;

}

  

.btn-danger {

  color: #f87171;

}

  

.btn-danger:hover {

  background: rgba(248, 113, 113, 0.1);

}

  

.btn-link {

  background: none;

  border: none;

  color: #60a5fa;

  cursor: pointer;

  font-size: 0.875rem;

  padding: 0.5rem 0;

}

  

.btn-link:hover {

  color: #93c5fd;

}

  

/* Section Header */

.section-header {

  display: flex;

  justify-content: space-between;

  align-items: center;

  flex-wrap: wrap;

  gap: 1rem;

}

  

.section-title {

  font-size: 1.5rem;

  font-weight: bold;

  color: white;

}

  

/* Forms */

.form-grid {

  display: grid;

  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));

  gap: 1rem;

  margin-bottom: 1rem;

}

  

.input {

  padding: 0.5rem 1rem;

  background: #334155;

  color: white;

  border-radius: 0.5rem;

  border: 1px solid #475569;

  font-size: 1rem;

}

  

.input:focus {

  outline: none;

  border-color: #60a5fa;

}

  

.input-full {

  grid-column: 1 / -1;

}

  

.form-label {

  color: #cbd5e1;

  font-weight: 600;

  margin-bottom: 0.5rem;

  display: block;

}

  

.form-actions {

  display: flex;

  gap: 0.5rem;

  flex-wrap: wrap;

}

  

.order-item-row {

  display: grid;

  grid-template-columns: repeat(3, 1fr);

  gap: 0.5rem;

  margin-bottom: 0.5rem;

}

  

/* Table */

.table-container {

  overflow-x: auto;

}

  

.table {

  width: 100%;

  border-collapse: collapse;

}

  

.table thead tr {

  border-bottom: 1px solid #475569;

}

  

.table th {

  text-align: left;

  padding: 0.75rem 1rem;

  color: #cbd5e1;

  font-weight: 600;

}

  

.table tbody tr {

  border-bottom: 1px solid rgba(71, 85, 105, 0.5);

  transition: all 0.2s;

}

  

.table tbody tr:hover {

  background: rgba(51, 65, 85, 0.3);

}

  

.table td {

  padding: 0.75rem 1rem;

  color: white;

}

  

.table-id {

  font-family: 'Courier New', monospace;

  font-size: 0.875rem;

  color: #cbd5e1;

}

  

.table-price {

  color: #34d399;

  font-weight: 600;

}

  

.table-empty {

  text-align: center;

  padding: 2rem 1rem;

  color: #94a3b8;

}

  

/* Badge */

.badge {

  padding: 0.25rem 0.75rem;

  border-radius: 9999px;

  font-size: 0.75rem;

  font-weight: 600;

}

  

.badge-yellow {

  background: rgba(251, 191, 36, 0.2);

  color: #fbbf24;

}

  

.badge-green {

  background: rgba(52, 211, 153, 0.2);

  color: #34d399;

}

  

/* Services Grid */

.services-grid {

  display: grid;

  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));

  gap: 0.75rem;

}

  

.service-card {

  background: rgba(51, 65, 85, 0.5);

  padding: 1rem;

  border-radius: 0.5rem;

  border: 1px solid #475569;

}

  

.service-name {

  font-weight: 600;

  color: white;

  font-size: 0.875rem;

  margin-bottom: 0.25rem;

}

  

.service-desc {

  font-size: 0.75rem;

  color: #94a3b8;

}

  

/* Functions */

.functions-list {

  display: flex;

  flex-direction: column;

  gap: 0.75rem;

}

  

.function-card {

  background: rgba(51, 65, 85, 0.5);

  padding: 1rem;

  border-radius: 0.5rem;

  border: 1px solid #475569;

}

  

.function-name {

  font-weight: 600;

  color: white;

  font-family: 'Courier New', monospace;

  font-size: 0.875rem;

  margin-bottom: 0.25rem;

}

  

.function-desc {

  font-size: 0.875rem;

  color: #94a3b8;

  margin-bottom: 0.5rem;

}

  

.endpoints {

  display: flex;

  flex-wrap: wrap;

  gap: 0.5rem;

  margin-top: 0.5rem;

}

  

.endpoint {

  padding: 0.25rem 0.5rem;

  background: #1e293b;

  color: #60a5fa;

  border-radius: 0.25rem;

  font-size: 0.75rem;

  font-family: 'Courier New', monospace;

}

  

/* Architecture Grid */

.architecture-grid {

  display: grid;

  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));

  gap: 1.5rem;

}

  

/* Data Flow */

.data-flow {

  display: flex;

  flex-direction: column;

  gap: 0.75rem;

}

  

.flow-step {

  display: flex;

  align-items: flex-start;

  gap: 0.75rem;

}

  

.flow-number {

  width: 2rem;

  height: 2rem;

  border-radius: 50%;

  background: #2563eb;

  display: flex;

  align-items: center;

  justify-content: center;

  color: white;

  font-weight: bold;

  font-size: 0.875rem;

  flex-shrink: 0;

}

  

.flow-step:nth-child(2) .flow-number { background: #059669; }

.flow-step:nth-child(3) .flow-number { background: #7c3aed; }

.flow-step:nth-child(4) .flow-number { background: #ea580c; }

.flow-step:nth-child(5) .flow-number { background: #dc2626; }

  

.flow-title {

  font-weight: 600;

  color: white;

  margin-bottom: 0.25rem;

}

  

.flow-desc {

  font-size: 0.875rem;

  color: #cbd5e1;

}

  

/* Instructions */

.instructions-list {

  list-style-position: inside;

  color: #cbd5e1;

  display: flex;

  flex-direction: column;

  gap: 0.5rem;

  font-size: 0.875rem;

}

  

.instructions-list li {

  padding-left: 0.5rem;

}

  

/* Footer */

.footer {

  background: rgba(30, 41, 59, 0.5);

  backdrop-filter: blur(10px);

  border-top: 1px solid rgba(71, 85, 105, 0.5);

  margin-top: 3rem;

}

  

.footer-content {

  max-width: 1280px;

  margin: 0 auto;

  padding: 1.5rem;

  display: flex;

  justify-content: space-between;

  align-items: center;

  flex-wrap: wrap;

  gap: 1rem;

  color: #94a3b8;

  font-size: 0.875rem;

}

  

/* Responsive */

@media (max-width: 768px) {

  .header-content {

    flex-direction: column;

    align-items: stretch;

  }

  

  .api-input {

    width: 100%;

  }

  

  .stats-grid {

    grid-template-columns: 1fr;

  }

  

  .actions-grid {

    grid-template-columns: 1fr;

  }

  

  .form-grid {

    grid-template-columns: 1fr;

  }

  

  .order-item-row {

    grid-template-columns: 1fr;

  }

  

  .services-grid {

    grid-template-columns: repeat(2, 1fr);

  }

  

  .architecture-grid {

    grid-template-columns: 1fr;

  }

  

  .footer-content {

    flex-direction: column;

    text-align: center;

  }

  

  .section-header {

    flex-direction: column;

    align-items: stretch;

  }

}

  

@media (max-width: 480px) {

  .header-title {

    font-size: 1.25rem;

  }

  

  .tabs {

    flex-direction: column;

  }

  

  .tab {

    justify-content: center;

  }

  

  .services-grid {

    grid-template-columns: 1fr;

  }

}
```


3. Create a GitHub repo and push this to it


### 13. Deploy on Amplify 

1. Click **"New app"**
2. Select **"Host web app"** from the dropdown
3. "From your existing code", select **"GitHub"**
4. In the "Repository" dropdown, find and select: **`ecommerce-dashboard`**
5. In the "Branch" dropdown, select: **`main`**
6. App name:** `ecommerce-dashboard` (or it may auto-fill)
7. **Build and test settings:**

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: build 
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*

```



Once complete, you'll see a URL press it


### 14. Test with the Web Interface

1. **Test Product Management:**
    - Click "Create Product" button
    - Fill in product details (name, category, price, stock)
    - Submit and verify in DynamoDB console
    - View products in the Products tab
2. **Test Order Processing:**
    - Click "Create Order" button
    - Enter customer ID and product details
    - Submit and verify inventory deduction
    - Check DynamoDB streams trigger
3. **Verify Analytics Pipeline:**
    - Check RDS PostgreSQL tables for aggregated data
    - Run the Redshift ETL Lambda manually or wait for scheduled execution
    - Query Redshift tables to verify data warehouse population







## Testing Your Project

### Step 13: Create Test Data

1. **Use API Gateway Test Console** or **Postman**
    
2. **Sample API Calls:**
    
    **Create Products:**
    
    ```bash
    POST /prod/products
    {
      "name": "Laptop Pro 15",
      "category": "Electronics",
      "price": 1299.99,
      "description": "High-performance laptop",
      "initial_stock": 50
    }
    ```
    
    **Create Orders:**
    
    ```bash
    POST /prod/orders
    {
      "customer_id": "customer123",
      "items": [
        {
          "product_id": "product-id-here",
          "quantity": 1,
          "price": 1299.99
        }
      ]
    }
    ```
    
    **Get Products:**
    
    ```bash
    GET /prod/products
    GET /prod/products?category=Electronics
    ```
    
3. **Generate Sample Data Script:** Create a Python script to populate your database with realistic test data:
    
    ```python
    import requests
    import random
    import json
    from datetime import datetime, timedelta
    
    API_BASE_URL = "https://your-api-gateway-url.com/prod"
    
    # Sample data
    categories = ["Electronics", "Clothing", "Books", "Home & Garden", "Sports"]
    products_data = [
        {"name": "Laptop Pro 15", "category": "Electronics", "price": 1299.99},
        {"name": "Wireless Headphones", "category": "Electronics", "price": 199.99},
        {"name": "Running Shoes", "category": "Sports", "price": 89.99},
        {"name": "Coffee Maker", "category": "Home & Garden", "price": 129.99},
        {"name": "Programming Book", "category": "Books", "price": 49.99}
    ]
    
    customers = [f"customer_{i}" for i in range(1, 21)]  # 20 customers
    
    def create_sample_products():
        product_ids = []
        for product in products_data:
            response = requests.post(f"{API_BASE_URL}/products", json=product)
            if response.status_code == 201:
                product_ids.append(response.json()["product_id"])
        return product_ids
    
    def create_sample_orders(product_ids):
        for _ in range(100):  # Create 100 orders
            customer_id = random.choice(customers)
            num_items = random.randint(1, 3)
            items = []
            
            for _ in range(num_items):
                product_id = random.choice(product_ids)
                quantity = random.randint(1, 3)
                price = random.uniform(20, 500)
                items.append({
                    "product_id": product_id,
                    "quantity": quantity,
                    "price": price
                })
            
            order_data = {
                "customer_id": customer_id,
                "items": items
            }
            
            response = requests.post(f"{API_BASE_URL}/orders", json=order_data)
            print(f"Order created: {response.status_code}")
    
    # Run the data generation
    if __name__ == "__main__":
        product_ids = create_sample_products()
        create_sample_orders(product_ids)
    ```
    

