{% macro generate_schema_name(custom_schema_name, node) -%}
    {{ log(">>> generate_schema_name called: custom=" ~ custom_schema_name ~ " target=" ~ target.schema, info=True) }}
    {%- if custom_schema_name is none -%}
        {{ target.schema }}
    {%- else -%}
        {{ custom_schema_name | trim }}
    {%- endif -%}
{%- endmacro %}

{% macro kikkoman_price_tracker__generate_schema_name(custom_schema_name, node) -%}
    {{ log(">>> kikkoman dispatch called: custom=" ~ custom_schema_name ~ " target=" ~ target.schema, info=True) }}
    {%- if custom_schema_name is none -%}
        {{ target.schema }}
    {%- else -%}
        {{ custom_schema_name | trim }}
    {%- endif -%}
{%- endmacro %}
