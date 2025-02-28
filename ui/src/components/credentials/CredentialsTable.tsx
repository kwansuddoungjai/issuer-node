import {
  Avatar,
  Button,
  Card,
  Dropdown,
  Radio,
  RadioChangeEvent,
  Row,
  Space,
  Table,
  TableColumnsType,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import dayjs from "dayjs";
import { useCallback, useEffect, useState } from "react";
import { Link, generatePath, useNavigate, useSearchParams } from "react-router-dom";

import { credentialStatusParser, getCredentials } from "src/adapters/api/credentials";
import { positiveIntegerFromStringParser } from "src/adapters/parsers";
import IconCreditCardPlus from "src/assets/icons/credit-card-plus.svg?react";
import IconCreditCardRefresh from "src/assets/icons/credit-card-refresh.svg?react";
import IconDots from "src/assets/icons/dots-vertical.svg?react";
import IconInfoCircle from "src/assets/icons/info-circle.svg?react";
import IconTrash from "src/assets/icons/trash-01.svg?react";
import IconClose from "src/assets/icons/x.svg?react";
import { CredentialDeleteModal } from "src/components/shared/CredentialDeleteModal";
import { CredentialRevokeModal } from "src/components/shared/CredentialRevokeModal";
import { ErrorResult } from "src/components/shared/ErrorResult";
import { NoResults } from "src/components/shared/NoResults";
import { TableCard } from "src/components/shared/TableCard";
import { useEnvContext } from "src/contexts/Env";
import { AppError, Credential } from "src/domain";
import { ROUTES } from "src/routes";
import { AsyncTask, isAsyncTaskDataAvailable, isAsyncTaskStarting } from "src/utils/async";
import { isAbortedError, makeRequestAbortable } from "src/utils/browser";
import {
  DEFAULT_PAGINATION_MAX_RESULTS,
  DEFAULT_PAGINATION_PAGE,
  DEFAULT_PAGINATION_TOTAL,
  DELETE,
  DETAILS,
  DOTS_DROPDOWN_WIDTH,
  EXPIRATION,
  ISSUED,
  ISSUE_CREDENTIAL,
  ISSUE_DATE,
  PAGINATION_MAX_RESULTS_PARAM,
  PAGINATION_PAGE_PARAM,
  QUERY_SEARCH_PARAM,
  REVOCATION,
  REVOKE,
  STATUS_SEARCH_PARAM,
} from "src/utils/constants";
import { notifyParseError, notifyParseErrors } from "src/utils/error";
import { formatDate } from "src/utils/forms";

export function CredentialsTable() {
  const env = useEnvContext();

  const navigate = useNavigate();

  const [credentials, setCredentials] = useState<AsyncTask<Credential[], AppError>>({
    status: "pending",
  });
  const [credentialToDelete, setCredentialToDelete] = useState<Credential>();
  const [credentialToRevoke, setCredentialToRevoke] = useState<Credential>();

  const [searchParams, setSearchParams] = useSearchParams();

  const statusParam = searchParams.get(STATUS_SEARCH_PARAM);
  const queryParam = searchParams.get(QUERY_SEARCH_PARAM);
  const parsedStatusParam = credentialStatusParser.safeParse(statusParam);
  const credentialStatus = parsedStatusParam.success ? parsedStatusParam.data : "all";

  const paginationPageParsed = positiveIntegerFromStringParser.safeParse(
    searchParams.get(PAGINATION_PAGE_PARAM)
  );
  const paginationMaxResultsParsed = positiveIntegerFromStringParser.safeParse(
    searchParams.get(PAGINATION_MAX_RESULTS_PARAM)
  );

  const [paginationTotal, setPaginationTotal] = useState<number>(DEFAULT_PAGINATION_TOTAL);

  const paginationPage = paginationPageParsed.success
    ? paginationPageParsed.data
    : DEFAULT_PAGINATION_PAGE;
  const paginationMaxResults = paginationMaxResultsParsed.success
    ? paginationMaxResultsParsed.data
    : DEFAULT_PAGINATION_MAX_RESULTS;

  const credentialsList = isAsyncTaskDataAvailable(credentials) ? credentials.data : [];
  const showDefaultContent =
    credentials.status === "successful" && credentialsList.length === 0 && queryParam === null;

  const tableColumns: TableColumnsType<Credential> = [
    {
      dataIndex: "schemaType",
      ellipsis: { showTitle: false },
      key: "schemaType",
      render: (schemaType: Credential["schemaType"]) => (
        <Tooltip placement="topLeft" title={schemaType}>
          <Typography.Text strong>{schemaType}</Typography.Text>
        </Tooltip>
      ),
      sorter: ({ schemaType: a }, { schemaType: b }) => a.localeCompare(b),
      title: "Credential",
    },
    {
      dataIndex: "createdAt",
      key: "createdAt",
      render: (createdAt: Credential["createdAt"]) => (
        <Typography.Text>{formatDate(createdAt)}</Typography.Text>
      ),
      sorter: ({ createdAt: a }, { createdAt: b }) => a.getTime() - b.getTime(),
      title: ISSUE_DATE,
    },
    {
      dataIndex: "expiresAt",
      key: "expiresAt",
      render: (expiresAt: Credential["expiresAt"], credential: Credential) =>
        expiresAt ? (
          <Tooltip placement="topLeft" title={formatDate(expiresAt)}>
            <Typography.Text>
              {credential.expired ? "Expired" : dayjs(expiresAt).fromNow(true)}
            </Typography.Text>
          </Tooltip>
        ) : (
          "-"
        ),
      responsive: ["md"],
      sorter: ({ expiresAt: a }, { expiresAt: b }) => {
        if (a && b) {
          return a.getTime() - b.getTime();
        } else if (a) {
          return -1;
        } else {
          return 1;
        }
      },
      title: EXPIRATION,
    },
    {
      dataIndex: "revoked",
      key: "revoked",
      render: (revoked: Credential["revoked"]) => (
        <Typography.Text>{revoked ? "Revoked" : "-"}</Typography.Text>
      ),
      responsive: ["sm"],
      sorter: ({ revoked: a }, { revoked: b }) => (a === b ? 0 : a ? 1 : -1),
      title: REVOCATION,
    },
    {
      dataIndex: "id",
      key: "id",
      render: (id: Credential["id"], credential: Credential) => (
        <Dropdown
          menu={{
            items: [
              {
                icon: <IconInfoCircle />,
                key: "details",
                label: DETAILS,
                onClick: () =>
                  navigate(generatePath(ROUTES.credentialDetails.path, { credentialID: id })),
              },
              {
                key: "divider1",
                type: "divider",
              },
              {
                danger: true,
                disabled: credential.revoked,
                icon: <IconClose />,
                key: "revoke",
                label: REVOKE,
                onClick: () => setCredentialToRevoke(credential),
              },
              {
                key: "divider2",
                type: "divider",
              },
              {
                danger: true,
                icon: <IconTrash />,
                key: "delete",
                label: DELETE,
                onClick: () => setCredentialToDelete(credential),
              },
            ],
          }}
        >
          <Row>
            <IconDots className="icon-secondary" />
          </Row>
        </Dropdown>
      ),
      width: DOTS_DROPDOWN_WIDTH,
    },
  ];

  const updatePaginationParams = useCallback(
    (pagination: { maxResults?: number; page?: number }) => {
      setSearchParams((previousParams) => {
        const params = new URLSearchParams(previousParams);
        params.set(
          PAGINATION_PAGE_PARAM,
          pagination.page !== undefined
            ? pagination.page.toString()
            : DEFAULT_PAGINATION_PAGE.toString()
        );
        params.set(
          PAGINATION_MAX_RESULTS_PARAM,
          pagination.maxResults !== undefined
            ? pagination.maxResults.toString()
            : DEFAULT_PAGINATION_MAX_RESULTS.toString()
        );
        return params;
      });
    },
    [setSearchParams]
  );

  const fetchCredentials = useCallback(
    async (signal?: AbortSignal) => {
      setCredentials((previousCredentials) =>
        isAsyncTaskDataAvailable(previousCredentials)
          ? { data: previousCredentials.data, status: "reloading" }
          : { status: "loading" }
      );

      const response = await getCredentials({
        env,
        params: {
          maxResults: paginationMaxResults,
          page: paginationPage,
          query: queryParam || undefined,
          status: credentialStatus,
        },
        signal,
      });
      if (response.success) {
        setCredentials({
          data: response.data.items.successful,
          status: "successful",
        });
        setPaginationTotal(response.data.meta.total);
        updatePaginationParams({
          maxResults: response.data.meta.max_results,
          page: response.data.meta.page,
        });
        notifyParseErrors(response.data.items.failed);
      } else {
        if (!isAbortedError(response.error)) {
          setCredentials({ error: response.error, status: "failed" });
        }
      }
    },
    [
      env,
      paginationMaxResults,
      paginationPage,
      queryParam,
      credentialStatus,
      updatePaginationParams,
    ]
  );

  const onSearch = useCallback(
    (query: string) => {
      setSearchParams((previousParams) => {
        const previousQuery = previousParams.get(QUERY_SEARCH_PARAM);
        const params = new URLSearchParams(previousParams);

        if (query === "") {
          params.delete(QUERY_SEARCH_PARAM);
          return params;
        } else if (previousQuery !== query) {
          params.set(QUERY_SEARCH_PARAM, query);
          return params;
        }
        return params;
      });
    },
    [setSearchParams]
  );

  const handleStatusChange = ({ target: { value } }: RadioChangeEvent) => {
    const parsedCredentialStatus = credentialStatusParser.safeParse(value);
    if (parsedCredentialStatus.success) {
      const params = new URLSearchParams(searchParams);

      if (parsedCredentialStatus.data === "all") {
        params.delete(STATUS_SEARCH_PARAM);
      } else {
        params.set(STATUS_SEARCH_PARAM, parsedCredentialStatus.data);
      }

      setSearchParams(params);
    } else {
      notifyParseError(parsedCredentialStatus.error);
    }
  };

  useEffect(() => {
    const { aborter } = makeRequestAbortable(fetchCredentials);

    return aborter;
  }, [fetchCredentials]);

  return (
    <>
      <TableCard
        defaultContents={
          <>
            <Avatar className="avatar-color-cyan" icon={<IconCreditCardRefresh />} size={48} />

            <Typography.Text strong>No credentials</Typography.Text>

            <Typography.Text type="secondary">
              Issued credentials will be listed here.
            </Typography.Text>

            {credentialStatus === "all" && (
              <Link to={generatePath(ROUTES.issueCredential.path)}>
                <Button icon={<IconCreditCardPlus />} type="primary">
                  {ISSUE_CREDENTIAL}
                </Button>
              </Link>
            )}
          </>
        }
        isLoading={isAsyncTaskStarting(credentials)}
        onSearch={onSearch}
        query={queryParam}
        searchPlaceholder="Search credentials, attributes, identifiers..."
        showDefaultContents={showDefaultContent}
        table={
          <Table
            columns={tableColumns.map(({ title, ...column }) => ({
              title: (
                <Typography.Text type="secondary">
                  <>{title}</>
                </Typography.Text>
              ),
              ...column,
            }))}
            dataSource={credentialsList}
            loading={credentials.status === "reloading"}
            locale={{
              emptyText:
                credentials.status === "failed" ? (
                  <ErrorResult error={credentials.error.message} />
                ) : (
                  <NoResults searchQuery={queryParam} />
                ),
            }}
            onChange={({ current, pageSize, total }) => {
              setPaginationTotal(total || DEFAULT_PAGINATION_TOTAL);
              updatePaginationParams({ maxResults: pageSize, page: current });
            }}
            pagination={{
              current: paginationPage,
              hideOnSinglePage: true,
              pageSize: paginationMaxResults,
              position: ["bottomRight"],
              total: paginationTotal,
            }}
            rowKey="id"
            showSorterTooltip
            sortDirections={["ascend", "descend"]}
          />
        }
        title={
          <Row gutter={[0, 8]} justify="space-between">
            <Space size="middle">
              <Card.Meta title={ISSUED} />

              <Tag color="blue">{paginationTotal}</Tag>
            </Space>

            {(!showDefaultContent || credentialStatus !== "all") && (
              <Radio.Group onChange={handleStatusChange} value={credentialStatus}>
                <Radio.Button value="all">All</Radio.Button>

                <Radio.Button value="revoked">Revoked</Radio.Button>

                <Radio.Button value="expired">Expired</Radio.Button>
              </Radio.Group>
            )}
          </Row>
        }
      />
      {credentialToDelete && (
        <CredentialDeleteModal
          credential={credentialToDelete}
          onClose={() => setCredentialToDelete(undefined)}
          onDelete={() => void fetchCredentials()}
        />
      )}
      {credentialToRevoke && (
        <CredentialRevokeModal
          credential={credentialToRevoke}
          onClose={() => setCredentialToRevoke(undefined)}
          onRevoke={() => void fetchCredentials()}
        />
      )}
    </>
  );
}
