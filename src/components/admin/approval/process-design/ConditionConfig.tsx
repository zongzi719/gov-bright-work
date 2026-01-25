import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Trash2, CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

// 条件项类型
interface Condition {
  id: string;
  field_name: string;
  operator: string;
  value: string | string[] | null;
  value2?: string | null; // 用于范围判断的第二个值
}

// 条件组类型
interface ConditionGroup {
  id: string;
  conditions: Condition[];
}

// 条件表达式类型
interface ConditionExpression {
  parent_id?: string;
  priority?: number;
  is_default?: boolean;
  condition_groups?: ConditionGroup[];
}

interface FormField {
  id: string;
  field_name: string;
  field_label: string;
  field_type?: string;
  is_required: boolean;
}

interface ConditionConfigProps {
  conditionExpression: ConditionExpression;
  formFields: FormField[];
  isDefault: boolean;
  onChange: (expression: ConditionExpression) => void;
}

// 不同字段类型对应的操作符
const operatorsByFieldType: Record<string, { value: string; label: string }[]> = {
  text: [
    { value: "equals", label: "等于" },
    { value: "not_equals", label: "不等于" },
    { value: "contains", label: "包含" },
    { value: "not_contains", label: "不包含" },
    { value: "starts_with", label: "开头是" },
    { value: "ends_with", label: "结尾是" },
    { value: "is_empty", label: "为空" },
    { value: "is_not_empty", label: "不为空" },
  ],
  textarea: [
    { value: "equals", label: "等于" },
    { value: "not_equals", label: "不等于" },
    { value: "contains", label: "包含" },
    { value: "not_contains", label: "不包含" },
    { value: "is_empty", label: "为空" },
    { value: "is_not_empty", label: "不为空" },
  ],
  number: [
    { value: "equals", label: "等于" },
    { value: "not_equals", label: "不等于" },
    { value: "greater_than", label: "大于" },
    { value: "less_than", label: "小于" },
    { value: "greater_than_or_equals", label: "大于等于" },
    { value: "less_than_or_equals", label: "小于等于" },
    { value: "in_range", label: "在范围内" },
    { value: "not_in_range", label: "不在范围内" },
    { value: "is_empty", label: "为空" },
    { value: "is_not_empty", label: "不为空" },
  ],
  money: [
    { value: "equals", label: "等于" },
    { value: "not_equals", label: "不等于" },
    { value: "greater_than", label: "大于" },
    { value: "less_than", label: "小于" },
    { value: "greater_than_or_equals", label: "大于等于" },
    { value: "less_than_or_equals", label: "小于等于" },
    { value: "in_range", label: "在范围内" },
    { value: "not_in_range", label: "不在范围内" },
    { value: "is_empty", label: "为空" },
    { value: "is_not_empty", label: "不为空" },
  ],
  date: [
    { value: "equals", label: "等于" },
    { value: "not_equals", label: "不等于" },
    { value: "before", label: "早于" },
    { value: "after", label: "晚于" },
    { value: "before_or_equals", label: "早于等于" },
    { value: "after_or_equals", label: "晚于等于" },
    { value: "in_range", label: "在范围内" },
    { value: "not_in_range", label: "不在范围内" },
    { value: "is_empty", label: "为空" },
    { value: "is_not_empty", label: "不为空" },
  ],
  datetime: [
    { value: "equals", label: "等于" },
    { value: "not_equals", label: "不等于" },
    { value: "before", label: "早于" },
    { value: "after", label: "晚于" },
    { value: "before_or_equals", label: "早于等于" },
    { value: "after_or_equals", label: "晚于等于" },
    { value: "in_range", label: "在范围内" },
    { value: "not_in_range", label: "不在范围内" },
    { value: "is_empty", label: "为空" },
    { value: "is_not_empty", label: "不为空" },
  ],
  select: [
    { value: "equals", label: "等于" },
    { value: "not_equals", label: "不等于" },
    { value: "in", label: "属于" },
    { value: "not_in", label: "不属于" },
    { value: "is_empty", label: "为空" },
    { value: "is_not_empty", label: "不为空" },
  ],
  radio: [
    { value: "equals", label: "等于" },
    { value: "not_equals", label: "不等于" },
    { value: "is_empty", label: "为空" },
    { value: "is_not_empty", label: "不为空" },
  ],
  checkbox: [
    { value: "contains", label: "包含" },
    { value: "not_contains", label: "不包含" },
    { value: "is_empty", label: "为空" },
    { value: "is_not_empty", label: "不为空" },
  ],
  user: [
    { value: "equals", label: "等于" },
    { value: "not_equals", label: "不等于" },
    { value: "in", label: "属于" },
    { value: "not_in", label: "不属于" },
    { value: "is_empty", label: "为空" },
    { value: "is_not_empty", label: "不为空" },
  ],
};

// 不需要匹配值的操作符
const noValueOperators = ["is_empty", "is_not_empty"];

// 需要范围值的操作符
const rangeOperators = ["in_range", "not_in_range"];

// 生成唯一ID
const generateId = () => Math.random().toString(36).substring(2, 9);

const ConditionConfig = ({ conditionExpression, formFields, isDefault, onChange }: ConditionConfigProps) => {
  const [groups, setGroups] = useState<ConditionGroup[]>([]);

  useEffect(() => {
    // 初始化条件组
    const existingGroups = conditionExpression?.condition_groups || [];
    if (existingGroups.length > 0) {
      setGroups(existingGroups);
    }
  }, [conditionExpression?.condition_groups]);

  // 更新父组件
  const updateExpression = (newGroups: ConditionGroup[]) => {
    setGroups(newGroups);
    onChange({
      ...conditionExpression,
      condition_groups: newGroups,
    });
  };

  // 添加条件组
  const handleAddGroup = () => {
    const newGroup: ConditionGroup = {
      id: generateId(),
      conditions: [
        {
          id: generateId(),
          field_name: "",
          operator: "equals",
          value: "",
        },
      ],
    };
    updateExpression([...groups, newGroup]);
  };

  // 删除条件组
  const handleRemoveGroup = (groupId: string) => {
    updateExpression(groups.filter(g => g.id !== groupId));
  };

  // 添加条件到组
  const handleAddCondition = (groupId: string) => {
    const newCondition: Condition = {
      id: generateId(),
      field_name: "",
      operator: "equals",
      value: "",
    };
    updateExpression(
      groups.map(g =>
        g.id === groupId
          ? { ...g, conditions: [...g.conditions, newCondition] }
          : g
      )
    );
  };

  // 删除条件
  const handleRemoveCondition = (groupId: string, conditionId: string) => {
    updateExpression(
      groups.map(g =>
        g.id === groupId
          ? { ...g, conditions: g.conditions.filter(c => c.id !== conditionId) }
          : g
      )
    );
  };

  // 更新条件
  const handleUpdateCondition = (groupId: string, conditionId: string, updates: Partial<Condition>) => {
    updateExpression(
      groups.map(g =>
        g.id === groupId
          ? {
              ...g,
              conditions: g.conditions.map(c =>
                c.id === conditionId ? { ...c, ...updates } : c
              ),
            }
          : g
      )
    );
  };

  // 获取字段类型
  const getFieldType = (fieldName: string): string => {
    const field = formFields.find(f => f.field_name === fieldName);
    return field?.field_type || "text";
  };

  // 获取字段标签
  const getFieldLabel = (fieldName: string): string => {
    const field = formFields.find(f => f.field_name === fieldName);
    return field?.field_label || fieldName;
  };

  // 获取可用的操作符
  const getOperators = (fieldName: string) => {
    const fieldType = getFieldType(fieldName);
    return operatorsByFieldType[fieldType] || operatorsByFieldType.text;
  };

  // 渲染值输入控件
  const renderValueInput = (condition: Condition, groupId: string) => {
    if (noValueOperators.includes(condition.operator)) {
      return (
        <Input
          value=""
          disabled
          className="bg-muted cursor-not-allowed"
          placeholder="无需填写"
        />
      );
    }

    const fieldType = getFieldType(condition.field_name);
    const isRange = rangeOperators.includes(condition.operator);

    // 日期类型
    if (fieldType === "date" || fieldType === "datetime") {
      return (
        <div className={cn("flex gap-2", isRange && "flex-col")}>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "justify-start text-left font-normal flex-1",
                  !condition.value && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {condition.value
                  ? format(new Date(condition.value as string), "yyyy-MM-dd")
                  : "选择日期"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={condition.value ? new Date(condition.value as string) : undefined}
                onSelect={(date) =>
                  handleUpdateCondition(groupId, condition.id, {
                    value: date?.toISOString() || "",
                  })
                }
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          {isRange && (
            <>
              <span className="text-sm text-muted-foreground text-center">至</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal flex-1",
                      !condition.value2 && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {condition.value2
                      ? format(new Date(condition.value2), "yyyy-MM-dd")
                      : "选择日期"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={condition.value2 ? new Date(condition.value2) : undefined}
                    onSelect={(date) =>
                      handleUpdateCondition(groupId, condition.id, {
                        value2: date?.toISOString() || "",
                      })
                    }
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </>
          )}
        </div>
      );
    }

    // 数字类型
    if (fieldType === "number" || fieldType === "money") {
      if (isRange) {
        return (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={condition.value as string || ""}
              onChange={(e) =>
                handleUpdateCondition(groupId, condition.id, { value: e.target.value })
              }
              placeholder="最小值"
              className="flex-1"
            />
            <span className="text-sm text-muted-foreground">至</span>
            <Input
              type="number"
              value={condition.value2 || ""}
              onChange={(e) =>
                handleUpdateCondition(groupId, condition.id, { value2: e.target.value })
              }
              placeholder="最大值"
              className="flex-1"
            />
          </div>
        );
      }
      return (
        <Input
          type="number"
          value={condition.value as string || ""}
          onChange={(e) =>
            handleUpdateCondition(groupId, condition.id, { value: e.target.value })
          }
          placeholder="请输入数值"
        />
      );
    }

    // 默认文本输入
    return (
      <Input
        value={condition.value as string || ""}
        onChange={(e) =>
          handleUpdateCondition(groupId, condition.id, { value: e.target.value })
        }
        placeholder="请输入匹配内容"
      />
    );
  };

  if (isDefault) {
    return (
      <div className="p-4 bg-muted/50 rounded-lg border">
        <div className="text-sm">
          <p className="font-medium mb-2">默认条件</p>
          <p className="text-muted-foreground">
            当其他条件都不满足时，流程将进入此分支。默认条件无需配置具体规则。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base">分支条件配置</Label>
          <p className="text-xs text-muted-foreground mt-1">
            条件组之间为"或"关系，组内条件为"且"关系
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={handleAddGroup}>
          <Plus className="w-4 h-4 mr-1" />
          添加条件组
        </Button>
      </div>

      {groups.length === 0 && (
        <div className="p-6 border-2 border-dashed rounded-lg text-center">
          <p className="text-muted-foreground text-sm mb-3">
            暂未配置条件，点击上方按钮添加条件组
          </p>
          <Button size="sm" variant="secondary" onClick={handleAddGroup}>
            <Plus className="w-4 h-4 mr-1" />
            添加条件组
          </Button>
        </div>
      )}

      {groups.map((group, groupIndex) => (
        <div key={group.id} className="relative">
          {/* 条件组之间的"或"标识 */}
          {groupIndex > 0 && (
            <div className="flex items-center justify-center my-3">
              <div className="flex-1 h-px bg-border" />
              <span className="px-3 text-sm text-primary font-medium bg-background">
                或
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>
          )}

          <div className="border rounded-lg p-4 bg-card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-muted-foreground">
                条件组 {groupIndex + 1}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-destructive hover:text-destructive"
                onClick={() => handleRemoveGroup(group.id)}
              >
                <Trash2 className="w-3 h-3 mr-1" />
                删除组
              </Button>
            </div>

            <div className="space-y-3">
              {group.conditions.map((condition, conditionIndex) => (
                <div key={condition.id}>
                  {/* 条件之间的"且"标识 */}
                  {conditionIndex > 0 && (
                    <div className="flex items-center justify-center my-2">
                      <span className="text-xs text-primary font-medium">且</span>
                    </div>
                  )}

                  <div className="flex items-start gap-2">
                    {/* 字段选择 */}
                    <div className="flex-1">
                      <Select
                        value={condition.field_name || "none"}
                        onValueChange={(value) =>
                          handleUpdateCondition(group.id, condition.id, {
                            field_name: value === "none" ? "" : value,
                            operator: "equals",
                            value: "",
                            value2: undefined,
                          })
                        }
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="选择字段" />
                        </SelectTrigger>
                        <SelectContent>
                          {formFields.map((field) => (
                            <SelectItem key={field.id} value={field.field_name}>
                              {field.field_label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* 操作符选择 */}
                    <div className="w-32">
                      <Select
                        value={condition.operator}
                        onValueChange={(value) =>
                          handleUpdateCondition(group.id, condition.id, {
                            operator: value,
                            value: noValueOperators.includes(value) ? null : condition.value,
                            value2: rangeOperators.includes(value) ? condition.value2 : undefined,
                          })
                        }
                        disabled={!condition.field_name}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="条件" />
                        </SelectTrigger>
                        <SelectContent>
                          {getOperators(condition.field_name).map((op) => (
                            <SelectItem key={op.value} value={op.value}>
                              {op.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* 值输入 */}
                    <div className="flex-1">
                      {condition.field_name && renderValueInput(condition, group.id)}
                    </div>

                    {/* 删除条件按钮 */}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 text-muted-foreground hover:text-destructive flex-shrink-0"
                      onClick={() => handleRemoveCondition(group.id, condition.id)}
                      disabled={group.conditions.length === 1}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <Button
              size="sm"
              variant="ghost"
              className="mt-3 text-primary"
              onClick={() => handleAddCondition(group.id)}
            >
              <Plus className="w-4 h-4 mr-1" />
              添加条件
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ConditionConfig;
