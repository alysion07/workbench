/**
 * Step1BasicInfo Component
 * Step 1: 기본 정보 입력 (Title, Description, Tags)
 */

import React, { useState } from 'react';
import { Box, TextField, Chip } from '@mui/material';
import type { WizardFormData } from './types';

interface Step1BasicInfoProps {
  data: WizardFormData;
  onChange: (data: Partial<WizardFormData>) => void;
}

const Step1BasicInfo: React.FC<Step1BasicInfoProps> = ({ data, onChange }) => {
  const [tagInput, setTagInput] = useState('');

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (tag && !data.tags.includes(tag)) {
      onChange({ tags: [...data.tags, tag] });
      setTagInput('');
    }
  };

  const handleDeleteTag = (tagToDelete: string) => {
    onChange({ tags: data.tags.filter((t) => t !== tagToDelete) });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        maxWidth: 600,
        mx: 'auto',
        py: 2,
      }}
    >
      {/* Title */}
      <TextField
        label="Title"
        value={data.title}
        onChange={(e) => onChange({ title: e.target.value })}
        fullWidth
        required
        placeholder="프로젝트 이름을 입력하세요"
        autoFocus
      />

      {/* Description */}
      <TextField
        label="Description"
        value={data.description}
        onChange={(e) => onChange({ description: e.target.value })}
        fullWidth
        multiline
        rows={3}
        placeholder="프로젝트 설명을 입력하세요 (선택)"
      />

      {/* Tags */}
      <Box>
        <TextField
          label="Tags"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyPress={handleKeyPress}
          onBlur={handleAddTag}
          placeholder="태그 입력 후 Enter"
          fullWidth
          helperText="태그를 입력하고 Enter를 누르세요"
        />
        {data.tags.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1.5 }}>
            {data.tags.map((tag) => (
              <Chip
                key={tag}
                label={tag}
                size="small"
                onDelete={() => handleDeleteTag(tag)}
                sx={{ borderRadius: 1 }}
              />
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default Step1BasicInfo;
