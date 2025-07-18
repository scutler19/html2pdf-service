PGDMP      (                 }           fileslap_metrics    16.9 (Debian 16.9-1.pgdg120+1)    16.9     G           0    0    ENCODING    ENCODING        SET client_encoding = 'UTF8';
                      false            H           0    0 
   STDSTRINGS 
   STDSTRINGS     (   SET standard_conforming_strings = 'on';
                      false            I           0    0 
   SEARCHPATH 
   SEARCHPATH     8   SELECT pg_catalog.set_config('search_path', '', false);
                      false            J           1262    16389    fileslap_metrics    DATABASE     {   CREATE DATABASE fileslap_metrics WITH TEMPLATE = template0 ENCODING = 'UTF8' LOCALE_PROVIDER = libc LOCALE = 'en_US.UTF8';
     DROP DATABASE fileslap_metrics;
                fileslap_metrics_user    false            K           0    0    fileslap_metrics    DATABASE PROPERTIES     9   ALTER DATABASE fileslap_metrics SET "TimeZone" TO 'utc';
                     fileslap_metrics_user    false                        2615    2200    public    SCHEMA     2   -- *not* creating schema, since initdb creates it
 2   -- *not* dropping schema, since initdb creates it
                fileslap_metrics_user    false                        3079    16399    pg_stat_statements 	   EXTENSION     F   CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA public;
 #   DROP EXTENSION pg_stat_statements;
                   false    6            L           0    0    EXTENSION pg_stat_statements    COMMENT     u   COMMENT ON EXTENSION pg_stat_statements IS 'track planning and execution statistics of all SQL statements executed';
                        false    2            M           0    0 U  FUNCTION pg_stat_statements(showtext boolean, OUT userid oid, OUT dbid oid, OUT toplevel boolean, OUT queryid bigint, OUT query text, OUT plans bigint, OUT total_plan_time double precision, OUT min_plan_time double precision, OUT max_plan_time double precision, OUT mean_plan_time double precision, OUT stddev_plan_time double precision, OUT calls bigint, OUT total_exec_time double precision, OUT min_exec_time double precision, OUT max_exec_time double precision, OUT mean_exec_time double precision, OUT stddev_exec_time double precision, OUT rows bigint, OUT shared_blks_hit bigint, OUT shared_blks_read bigint, OUT shared_blks_dirtied bigint, OUT shared_blks_written bigint, OUT local_blks_hit bigint, OUT local_blks_read bigint, OUT local_blks_dirtied bigint, OUT local_blks_written bigint, OUT temp_blks_read bigint, OUT temp_blks_written bigint, OUT blk_read_time double precision, OUT blk_write_time double precision, OUT temp_blk_read_time double precision, OUT temp_blk_write_time double precision, OUT wal_records bigint, OUT wal_fpi bigint, OUT wal_bytes numeric, OUT jit_functions bigint, OUT jit_generation_time double precision, OUT jit_inlining_count bigint, OUT jit_inlining_time double precision, OUT jit_optimization_count bigint, OUT jit_optimization_time double precision, OUT jit_emission_count bigint, OUT jit_emission_time double precision)    ACL     �  GRANT ALL ON FUNCTION public.pg_stat_statements(showtext boolean, OUT userid oid, OUT dbid oid, OUT toplevel boolean, OUT queryid bigint, OUT query text, OUT plans bigint, OUT total_plan_time double precision, OUT min_plan_time double precision, OUT max_plan_time double precision, OUT mean_plan_time double precision, OUT stddev_plan_time double precision, OUT calls bigint, OUT total_exec_time double precision, OUT min_exec_time double precision, OUT max_exec_time double precision, OUT mean_exec_time double precision, OUT stddev_exec_time double precision, OUT rows bigint, OUT shared_blks_hit bigint, OUT shared_blks_read bigint, OUT shared_blks_dirtied bigint, OUT shared_blks_written bigint, OUT local_blks_hit bigint, OUT local_blks_read bigint, OUT local_blks_dirtied bigint, OUT local_blks_written bigint, OUT temp_blks_read bigint, OUT temp_blks_written bigint, OUT blk_read_time double precision, OUT blk_write_time double precision, OUT temp_blk_read_time double precision, OUT temp_blk_write_time double precision, OUT wal_records bigint, OUT wal_fpi bigint, OUT wal_bytes numeric, OUT jit_functions bigint, OUT jit_generation_time double precision, OUT jit_inlining_count bigint, OUT jit_inlining_time double precision, OUT jit_optimization_count bigint, OUT jit_optimization_time double precision, OUT jit_emission_count bigint, OUT jit_emission_time double precision) TO fileslap_metrics_user;
          public          postgres    false    236            N           0    0 ^   FUNCTION pg_stat_statements_info(OUT dealloc bigint, OUT stats_reset timestamp with time zone)    ACL     �   GRANT ALL ON FUNCTION public.pg_stat_statements_info(OUT dealloc bigint, OUT stats_reset timestamp with time zone) TO fileslap_metrics_user;
          public          postgres    false    235            �            1259    16459    accounts    TABLE     �   CREATE TABLE public.accounts (
    api_key text NOT NULL,
    email text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);
    DROP TABLE public.accounts;
       public         heap    fileslap_metrics_user    false    6            �            1259    16449    api_keys    TABLE     �   CREATE TABLE public.api_keys (
    api_key text NOT NULL,
    email text,
    created_at timestamp with time zone DEFAULT now(),
    plan_price text DEFAULT 'price_free_50'::text,
    paused boolean DEFAULT false NOT NULL
);
    DROP TABLE public.api_keys;
       public         heap    fileslap_metrics_user    false    6            �            1259    16431    page_events    TABLE     �   CREATE TABLE public.page_events (
    id integer NOT NULL,
    api_key text NOT NULL,
    pages integer NOT NULL,
    bytes integer NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);
    DROP TABLE public.page_events;
       public         heap    fileslap_metrics_user    false    6            �            1259    16430    page_events_id_seq    SEQUENCE     �   CREATE SEQUENCE public.page_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
 )   DROP SEQUENCE public.page_events_id_seq;
       public          fileslap_metrics_user    false    6    219            O           0    0    page_events_id_seq    SEQUENCE OWNED BY     I   ALTER SEQUENCE public.page_events_id_seq OWNED BY public.page_events.id;
          public          fileslap_metrics_user    false    218            �            1259    16440    subscriptions    TABLE     �   CREATE TABLE public.subscriptions (
    api_key text NOT NULL,
    subscription_id text NOT NULL,
    price_id text NOT NULL,
    paused boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);
 !   DROP TABLE public.subscriptions;
       public         heap    fileslap_metrics_user    false    6            �           2604    16434    page_events id    DEFAULT     p   ALTER TABLE ONLY public.page_events ALTER COLUMN id SET DEFAULT nextval('public.page_events_id_seq'::regclass);
 =   ALTER TABLE public.page_events ALTER COLUMN id DROP DEFAULT;
       public          fileslap_metrics_user    false    218    219    219            D          0    16459    accounts 
   TABLE DATA           >   COPY public.accounts (api_key, email, created_at) FROM stdin;
    public          fileslap_metrics_user    false    222   +       C          0    16449    api_keys 
   TABLE DATA           R   COPY public.api_keys (api_key, email, created_at, plan_price, paused) FROM stdin;
    public          fileslap_metrics_user    false    221   �,       A          0    16431    page_events 
   TABLE DATA           L   COPY public.page_events (id, api_key, pages, bytes, created_at) FROM stdin;
    public          fileslap_metrics_user    false    219   v-       B          0    16440    subscriptions 
   TABLE DATA           _   COPY public.subscriptions (api_key, subscription_id, price_id, paused, updated_at) FROM stdin;
    public          fileslap_metrics_user    false    220   /       P           0    0    page_events_id_seq    SEQUENCE SET     A   SELECT pg_catalog.setval('public.page_events_id_seq', 14, true);
          public          fileslap_metrics_user    false    218            �           2606    16465    accounts accounts_pkey 
   CONSTRAINT     Y   ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (api_key);
 @   ALTER TABLE ONLY public.accounts DROP CONSTRAINT accounts_pkey;
       public            fileslap_metrics_user    false    222            �           2606    16458    api_keys api_keys_pkey 
   CONSTRAINT     Y   ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_pkey PRIMARY KEY (api_key);
 @   ALTER TABLE ONLY public.api_keys DROP CONSTRAINT api_keys_pkey;
       public            fileslap_metrics_user    false    221            �           2606    16439    page_events page_events_pkey 
   CONSTRAINT     Z   ALTER TABLE ONLY public.page_events
    ADD CONSTRAINT page_events_pkey PRIMARY KEY (id);
 F   ALTER TABLE ONLY public.page_events DROP CONSTRAINT page_events_pkey;
       public            fileslap_metrics_user    false    219            �           2606    16448     subscriptions subscriptions_pkey 
   CONSTRAINT     c   ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (api_key);
 J   ALTER TABLE ONLY public.subscriptions DROP CONSTRAINT subscriptions_pkey;
       public            fileslap_metrics_user    false    220                       826    16391     DEFAULT PRIVILEGES FOR SEQUENCES    DEFAULT ACL     \   ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT ALL ON SEQUENCES TO fileslap_metrics_user;
                   postgres    false                       826    16393    DEFAULT PRIVILEGES FOR TYPES    DEFAULT ACL     X   ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT ALL ON TYPES TO fileslap_metrics_user;
                   postgres    false                       826    16392     DEFAULT PRIVILEGES FOR FUNCTIONS    DEFAULT ACL     \   ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT ALL ON FUNCTIONS TO fileslap_metrics_user;
                   postgres    false                       826    16390    DEFAULT PRIVILEGES FOR TABLES    DEFAULT ACL     Y   ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT ALL ON TABLES TO fileslap_metrics_user;
                   postgres    false            D   �  x�u�Io�` �����o �̰�p���	AeQ�����ܤus�OޜTs�c�;TX�q�dq0�Ouϝ�T>w9�����e��W�,�@ipȽ8��"�!�(�7�e eJy@&�? �T���֓��@排��ui_S��d�o�x}�'�[x�����Y��I�2,BԹZah8k����G����|C���B�&��ṙ�q�_��;��Ȑ���B���6P]lA2��:Ά@�w
E9Vq<�nAu�]2��C���fy	1�V�=�[���5�I焾y�����D��jF,�S�+#�J<��V]8���Uñ�g�vl@�5�O�I��Ρk����9v*~�$c��� d�)pP�|T�}��e���o"e;��hY?g1��J_�T���� ��@K߉�q29+H+pW�Y�����\�I5�Rw!Ԗݩ�w��@�)���;������Tm�N      C   �   x�m�M�0 ���+�����ݲ�K#AR[EZ΋������k9TcR��o��0�@Q�}x��qRc�Hg	&�	�
3#����1�5 ���Ż0{�$�@�[���`�n�Ϸ�U�^�'����320<3��(���إ��/�n-G      A   �  x���]OA������tr>fΙ�J�
-+BYcҬ���Z@��zw����ד<9��`�:K�n��I0Q���k�4I��F����+�%w�FE�ʿ�,�ݧp�ه������]O�Y��������]z�\x�F'�z�l}����='��'�*���iD2@D*���%.�*Ov��G�����8r�9�#��U�(�����Ձ���fݝdr�pr1}X���fs��8��~�5A�O�6+�jtlT��Z9a��?�2G}P��A�p�oȂA�����P�x� 5D�E�T6KH� N:��/6-�u�W|8(z7��9���v"|�[����iҳɨ:Mv�CV�>F�I��������NZ���r�S�<^M��y_��%�n=�.�TݲB���M���	��      B   �  x���K��P��~��ȹ����EEp��4!�\=���O߱��u�,�����ױkF1Dxtkv12�, ��D��(8:y�i5�\�}�1�u�f�E�u��Q6B QH�� D��J�� �����uv,�;zִ��6�N[��PH���f^y���'"�2T��Zrv������"��T��<Q� �Ք��A�u������9�t�@s�߈v3T�Z��"�^CP(*QD�@
�1Kb!�s�^�e.�t��=�n9�*k�5>�[_�>�p����_E`�R(N ���;��.,L�ͻG*���K�tZ5ktI�Ūݤ��F����]㳶zA���()Q��@]���u��om]i�dv�fZ��ym���_���y����n�}A?�AD�O�q<�j�ާ     