"use client";

import { useId } from "react";
import {
  Button,
  Callout,
  Card,
  Checkbox,
  Flex,
  Heading,
  Separator,
  Switch,
  Table,
  Tabs,
  Text,
  TextField
} from "@radix-ui/themes";
import { Theme } from "@radix-ui/themes";

export default function ThemePreview() {
  const checkboxId = useId();

  return (
    <Flex direction="column" gap="4" p="4">
      <Heading as="h1" size="6">
        Theme Preview
      </Heading>

      <Text size="3" weight="bold">
        Primary (crimson/mauve)
      </Text>
      <Flex gap="3" wrap="wrap">
        <Button>Primary</Button>
        <Button variant="soft">Soft</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button color="red">Danger</Button>
        <Button disabled>Disabled</Button>
      </Flex>

      <Separator my="3" />

      <Theme accentColor="indigo" grayColor="slate">
        <Text size="3" weight="bold">
          Secondary section (indigo/slate)
        </Text>
        <Flex gap="3" wrap="wrap">
          <Button>Primary</Button>
          <Button variant="soft">Soft</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
        </Flex>
      </Theme>

      <Card>
        <Text>Card surface (gray scale)</Text>
      </Card>

      <Flex gap="3" wrap="wrap" mt="3">
        <TextField.Root placeholder="Text field" />
        <Switch defaultChecked />
        <Flex align="center" gap="2">
          <Checkbox id={checkboxId} defaultChecked />
          <Text asChild>
            <label htmlFor={checkboxId}>Checkbox</label>
          </Text>
        </Flex>
      </Flex>

      <Separator my="3" />

      <Tabs.Root defaultValue="one">
        <Tabs.List>
          <Tabs.Trigger value="one">One</Tabs.Trigger>
          <Tabs.Trigger value="two">Two</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="one">Tab content one</Tabs.Content>
        <Tabs.Content value="two">Tab content two</Tabs.Content>
      </Tabs.Root>

      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeaderCell>Col A</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Col B</Table.ColumnHeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          <Table.Row>
            <Table.Cell>Value A1</Table.Cell>
            <Table.Cell>Value B1</Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table.Root>

      <Callout.Root>
        <Callout.Text>Neutral callout (uses gray scale).</Callout.Text>
      </Callout.Root>
    </Flex>
  );
}
